// src/github/zipImport.ts
// استيراد مشروع من ملف ZIP على الجهاز: بنفتح الفهرس، بنستبعد اللي ميتستوردش (مجلدات
// مولّدة، ملفات سرية، ثنائية، كبيرة)، وبنفك الباقي ونبني قايمة ملفات المشروع.
// منطق صرف: التخزين بييجي من برّه، والمشروع مبيتربطش بـ GitHub (الرفع بعدين من لوحة المزامنة).
import { applyRemote } from './applyRemote';
import type { ApplyStore } from './applyRemote';
import { classifyPath, findSecretInText } from './ignore';
import { utf8Decode } from './codec';
import { listZip, readEntry, ZipError } from './zipReader';
import type { ZipEntry } from './zipReader';
import { detectLanguage, MAX_IMPORT_BYTES, MAX_IMPORT_FILES } from './importRepo';
import type { ImportLanguage } from './importRepo';
import { MAX_PULL_FILE_BYTES } from './pullPlan';
import type { PullSkip } from './pullPlan';
import { isImageName } from '../terminal/net';
import type { FsNode } from '../terminal/types';

export type ZipImportErrorCode = 'bad_zip' | 'unsupported' | 'no_files' | 'too_big' | 'unknown';

export class ZipImportError extends Error {
  code: ZipImportErrorCode;
  constructor(code: ZipImportErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ZipImportError';
    this.code = code;
  }
}

export type ZipProgress = { phase: 'extract' | 'apply'; done: number; total: number };

export interface ZipImportResult {
  name: string;
  nodes: FsNode[];
  language: ImportLanguage;
  fileCount: number;
  skipped: PullSkip[];
}

// ZIP حقيقي بيبدأ بـ PK (local header، أو EOCD لو فاضي)
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bytesToBase64(b: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  let i = 0;
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
    chunk += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  if (i + 1 === b.length) {
    const n = b[i] << 16;
    chunk += B64[n >> 18] + B64[(n >> 12) & 63] + '==';
  } else if (i + 2 === b.length) {
    const n = (b[i] << 16) | (b[i + 1] << 8);
    chunk += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  parts.push(chunk);
  return parts.join('');
}

// اسم المشروع من اسم الملف: من غير .zip ومن غير مسافات زيادة
export function projectNameFromFile(fileName: string, fallback: string): string {
  const n = fileName.replace(/\.zip$/i, '').trim();
  return n || fallback;
}

interface Candidate {
  path: string;
  entry: ZipEntry;
}

// بيطبّع مسارات الـ ZIP: \ بتبقى /، بيشيل / البداية، وبيستبعد أي مسار فيه .. (حماية)،
// ومجلدات macOS الزايدة. بيرجّع null للي يتخطّى من غير ما يتعرض كملف مستبعد.
function cleanPath(name: string): string | null {
  const p = name.replace(/\\/g, '/').replace(/^\/+/, '');
  const segs = p.split('/').filter((s) => s !== '' && s !== '.');
  if (segs.length === 0) return null;
  if (segs.some((s) => s === '..')) return null;
  if (segs[0] === '__MACOSX' || segs.some((s) => s.startsWith('._'))) return null;
  return segs.join('/');
}

// لو كل الملفات جوه مجلد واحد (الشكل المعتاد لما تضغط مجلد) نشيل المجلد ده
export function stripCommonRoot(paths: string[]): string[] {
  if (paths.length === 0) return paths;
  const first = paths[0].split('/')[0];
  const all = paths.every((p) => p.includes('/') && p.split('/')[0] === first);
  return all ? paths.map((p) => p.slice(first.length + 1)) : paths;
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export async function importZip(
  bytes: Uint8Array,
  fileName: string,
  fallbackName: string,
  store: ApplyStore,
  onProgress?: (p: ZipProgress) => void
): Promise<ZipImportResult> {
  try {
    if (!looksLikeZip(bytes)) throw new ZipImportError('bad_zip');
    const entries = listZip(bytes);

    // 1) فرز من الفهرس بس (من غير فك ضغط)
    const skipped: PullSkip[] = [];
    const byPath = new Map<string, ZipEntry>();
    const cleaned: { path: string; entry: ZipEntry }[] = [];
    for (const e of entries) {
      if (e.isDir) continue;
      const p = cleanPath(e.name);
      if (p !== null) cleaned.push({ path: p, entry: e });
    }
    const stripped = stripCommonRoot(cleaned.map((c) => c.path));
    cleaned.forEach((c, i) => {
      // المجلد الجذر نفسه ممكن يكون مجلد مستبعد (node_modules مثلًا): نفحص المسار الأصلي كمان
      if (stripped[i] !== '' && classifyPath(c.path) !== 'ignore') byPath.set(stripped[i], c.entry);
    });

    const wanted: Candidate[] = [];
    let totalBytes = 0;
    for (const [path, entry] of [...byPath.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
      const verdict = classifyPath(path);
      if (verdict === 'ignore') continue;
      if (verdict === 'secret') {
        skipped.push({ path, reason: 'secret' });
        continue;
      }
      if (entry.size > MAX_PULL_FILE_BYTES) {
        skipped.push({ path, reason: 'too_large' });
        continue;
      }
      totalBytes += entry.size;
      wanted.push({ path, entry });
    }
    if (wanted.length === 0) throw new ZipImportError('no_files');
    if (wanted.length > MAX_IMPORT_FILES || totalBytes > MAX_IMPORT_BYTES) throw new ZipImportError('too_big');

    // 2) فك الضغط (واحد واحد، مع نفَس للواجهة)
    const writes: { path: string; content: string }[] = [];
    onProgress?.({ phase: 'extract', done: 0, total: wanted.length });
    let lastTick = Date.now();
    for (let i = 0; i < wanted.length; i++) {
      const { path, entry } = wanted[i];
      const data = readEntry(bytes, entry);
      if (isImageName(path)) {
        writes.push({ path, content: bytesToBase64(data) });
      } else {
        const text = utf8Decode(data);
        if (text === null) skipped.push({ path, reason: 'binary' });
        else if (findSecretInText(text) !== null) skipped.push({ path, reason: 'secret' });
        else writes.push({ path, content: text });
      }
      if (Date.now() - lastTick > 50) {
        onProgress?.({ phase: 'extract', done: i + 1, total: wanted.length });
        await tick();
        lastTick = Date.now();
      }
    }
    onProgress?.({ phase: 'extract', done: wanted.length, total: wanted.length });

    // 3) بناء المشروع
    onProgress?.({ phase: 'apply', done: 0, total: 1 });
    const applied = await applyRemote([], writes, [], store);
    onProgress?.({ phase: 'apply', done: 1, total: 1 });
    if (applied.writtenCount === 0) throw new ZipImportError('no_files');

    const written = writes.map((w) => w.path).filter((p) => !applied.failed.some((f) => f.path === p));
    return {
      name: projectNameFromFile(fileName, fallbackName),
      nodes: applied.nodes,
      language: detectLanguage(written),
      fileCount: applied.writtenCount,
      skipped: [...skipped, ...applied.failed],
    };
  } catch (err) {
    if (err instanceof ZipImportError) throw err;
    if (err instanceof ZipError) throw new ZipImportError(err.code, err.message);
    throw new ZipImportError('unknown', String(err));
  }
}