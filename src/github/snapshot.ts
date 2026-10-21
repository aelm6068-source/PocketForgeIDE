// src/github/snapshot.ts
// بيحوّل ملفات المشروع (شجرة id/parentId + محتوى) لقائمة ملفات بمساراتها الكاملة
// جاهزة للرفع، ويستبعد اللي ميترفعش (مولّد، أسرار، كبير). منطق صرف من غير
// React Native: القراءة بتيجي من دالة readContent اللي بنمررها.
import { classifyPath, findSecretInText } from './ignore';
import { isImageName } from '../terminal/net';

export interface SnapshotNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
}

export interface SnapshotEntry {
  path: string;
  content: string;
  // نص عادي (utf-8) أو صورة متخزنة base64
  encoding: 'utf-8' | 'base64';
  size: number; // بالبايت الحقيقي
}

export type SkipReason = 'ignored' | 'secret' | 'secret_content' | 'too_large' | 'too_many' | 'broken_path' | 'duplicate';

export interface SkippedItem {
  path: string;
  reason: SkipReason;
}

export interface Snapshot {
  entries: SnapshotEntry[];
  skipped: SkippedItem[];
  totalBytes: number;
}

export interface SnapshotLimits {
  maxFileBytes: number;
  maxTotalBytes: number;
  maxFiles: number;
  // أكبر حجم نص بنفحصه بحثًا عن مفاتيح (الملفات النصية الأكبر منه مش بتتفحص)
  maxScanChars: number;
}

export const DEFAULT_LIMITS: SnapshotLimits = {
  maxFileBytes: 20 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024,
  maxFiles: 5000,
  maxScanChars: 512 * 1024,
};

// طول النص بالبايت (UTF-8) من غير TextEncoder
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

// حجم الصورة الحقيقي من نص base64
export function base64ByteLength(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

// لو الصورة متخزنة كـ data URI نشيل الجزء اللي قبل الفاصلة، ونشيل أي مسافات/أسطر
function cleanBase64(raw: string): string {
  const s = raw.startsWith('data:') ? raw.slice(raw.indexOf(',') + 1) : raw;
  return s.replace(/\s+/g, '');
}

function buildPaths(nodes: SnapshotNode[]): Map<string, string | null> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const result = new Map<string, string | null>();
  for (const node of nodes) {
    const parts: string[] = [];
    const seen = new Set<string>();
    let cur: SnapshotNode | undefined = node;
    let broken = false;
    while (cur) {
      if (seen.has(cur.id)) {
        broken = true;
        break;
      }
      seen.add(cur.id);
      parts.unshift(cur.name);
      if (cur.parentId === null) break;
      cur = byId.get(cur.parentId);
      if (!cur) broken = true;
    }
    result.set(node.id, broken ? null : parts.join('/'));
  }
  return result;
}

export async function buildSnapshot(
  nodes: SnapshotNode[],
  readContent: (id: string) => Promise<string | null>,
  limits: SnapshotLimits = DEFAULT_LIMITS
): Promise<Snapshot> {
  const paths = buildPaths(nodes);
  const entries: SnapshotEntry[] = [];
  const skipped: SkippedItem[] = [];
  const usedPaths = new Set<string>();
  let totalBytes = 0;

  const files = nodes
    .filter((n) => n.type === 'file')
    .map((n) => ({ node: n, path: paths.get(n.id) ?? null }))
    .sort((a, b) => (a.path ?? '').localeCompare(b.path ?? ''));

  for (const { node, path } of files) {
    if (path === null) {
      skipped.push({ path: node.name, reason: 'broken_path' });
      continue;
    }
    const verdict = classifyPath(path);
    if (verdict === 'ignore') {
      skipped.push({ path, reason: 'ignored' });
      continue;
    }
    if (verdict === 'secret') {
      skipped.push({ path, reason: 'secret' });
      continue;
    }
    if (usedPaths.has(path)) {
      skipped.push({ path, reason: 'duplicate' });
      continue;
    }
    if (entries.length >= limits.maxFiles) {
      skipped.push({ path, reason: 'too_many' });
      continue;
    }

    const raw = (await readContent(node.id)) ?? '';
    const image = isImageName(node.name);
    const content = image ? cleanBase64(raw) : raw;
    const size = image ? base64ByteLength(content) : utf8Length(content);

    if (size > limits.maxFileBytes || totalBytes + size > limits.maxTotalBytes) {
      skipped.push({ path, reason: 'too_large' });
      continue;
    }
    if (!image && content.length <= limits.maxScanChars && findSecretInText(content)) {
      skipped.push({ path, reason: 'secret_content' });
      continue;
    }

    usedPaths.add(path);
    totalBytes += size;
    entries.push({ path, content, encoding: image ? 'base64' : 'utf-8', size });
  }

  return { entries, skipped, totalBytes };
}