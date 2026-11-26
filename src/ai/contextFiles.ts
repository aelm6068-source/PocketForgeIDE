// src/ai/contextFiles.ts
// بناء نص "ملفات السياق" الي المستخدم اختارها وتتبعت مع الرسالة. بيستبعد الأسرار والملفات الثنائية
// والمسارات المتجاهلة، وبيحدّد حجم كل ملف والإجمالي. منطق بحت (من غير react).
import { classifyPath, findSecretInText } from '../github/ignore';

export const MAX_CONTEXT_FILES = 20;
export const MAX_FILE_CHARS = 20000;
export const MAX_TOTAL_CHARS = 100000;

export interface ContextEntry {
  path: string;
  content: string | null; // null = مش موجود/فشلت القراءة
}
export interface ContextResult {
  text: string;
  included: string[];
  truncated: string[];
  skipped: string[];
}

// مفاتيح إضافية مش في github/ignore (Gemini و Hugging Face)
const EXTRA_SECRETS: RegExp[] = [/\bAIza[0-9A-Za-z_-]{30,}\b/, /\bhf_[A-Za-z0-9]{30,}\b/];

export function looksBinary(s: string): boolean {
  if (s.includes('\u0000')) return true;
  const sample = s.slice(0, 4000);
  if (!sample) return false;
  let bad = 0;
  for (let i = 0; i < sample.length; i++) if (sample.charCodeAt(i) === 0xfffd) bad++;
  return bad / sample.length > 0.02;
}

function hasSecret(s: string): boolean {
  return findSecretInText(s) !== null || EXTRA_SECRETS.some((re) => re.test(s));
}

// حكم على ملف قبل ما نبعت محتواه لأي موديل (بيتشارك مع أدوات القراءة)
export type ContentVerdict = 'ok' | 'empty' | 'path' | 'binary' | 'secret';
export function contentVerdict(path: string, content: string): ContentVerdict {
  if (!content.trim()) return 'empty';
  if (classifyPath(path) !== 'include') return 'path';
  if (looksBinary(content)) return 'binary';
  if (hasSecret(content)) return 'secret';
  return 'ok';
}

function fenceFor(content: string): string {
  let longest = 0;
  const runs = content.match(/`+/g);
  if (runs) for (const r of runs) longest = Math.max(longest, r.length);
  return '`'.repeat(Math.max(3, longest + 1));
}

export function buildFileContext(entries: ContextEntry[]): ContextResult {
  const included: string[] = [];
  const truncated: string[] = [];
  const skipped: string[] = [];
  const blocks: string[] = [];
  let total = 0;

  for (const e of entries) {
    const raw = e.content;
    if (raw === null || contentVerdict(e.path, raw) !== 'ok') {
      skipped.push(e.path);
      continue;
    }
    const room = MAX_TOTAL_CHARS - total;
    if (room <= 0) {
      skipped.push(e.path);
      continue;
    }
    const limit = Math.min(MAX_FILE_CHARS, room);
    let body = raw;
    if (body.length > limit) {
      body = body.slice(0, limit) + '\n… [truncated]';
      truncated.push(e.path);
    }
    total += Math.min(raw.length, limit);
    const f = fenceFor(body);
    blocks.push(`### FILE: ${e.path}\n${f}\n${body}\n${f}`);
    included.push(e.path);
  }

  const text = blocks.length ? `Project files provided by the user:\n\n${blocks.join('\n\n')}` : '';
  return { text, included, truncated, skipped };
}
