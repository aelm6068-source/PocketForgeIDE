// طبقة الشبكة للطرفية: fetch + تصنيف المحتوى + تحويل base64.
// بدون أي اعتماد على React Native (بتستخدم fetch العام الموجود في التطبيق والمتصفح وNode).

export interface NetHeaders {
  get(name: string): string | null;
  forEach(cb: (value: string, key: string) => void): void;
}
export interface NetResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: NetHeaders;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export interface NetInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: unknown;
}
export type NetFetch = (url: string, init?: NetInit) => Promise<NetResponse>;

// الحد الأقصى لحجم أي تنزيل (النص والصور بتتخزن في الذاكرة كنص، فمش بنسمح بملفات ضخمة)
export const MAX_BYTES = 8 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 30000;

// امتدادات الصور اللي التطبيق بيخزّنها كـ base64 (لازم تفضل مطابقة لـ IMAGE_EXTENSIONS في theme/defaultAssets.ts)
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
// امتدادات نصية معروفة: بنثق فيها حتى لو السيرفر بعت نوع محتوى غريب
const TEXT_EXT = [
  'txt', 'md', 'json', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'htm',
  'xml', 'svg', 'yml', 'yaml', 'csv', 'tsv', 'toml', 'ini', 'env', 'sh', 'java', 'kt', 'py',
  'gradle', 'properties', 'lock', 'map', 'log',
];

let impl: NetFetch | null = null;
/** للاختبارات أو لاستبدال fetch بنسخة تانية */
export function setFetch(f: NetFetch | null): void {
  impl = f;
}
export function getFetch(): NetFetch | null {
  if (impl) return impl;
  const g = globalThis as unknown as { fetch?: NetFetch };
  return typeof g.fetch === 'function' ? g.fetch.bind(globalThis) : null;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}
export const isImageName = (name: string): boolean => IMAGE_EXT.includes(extOf(name));
export const isTextName = (name: string): boolean => TEXT_EXT.includes(extOf(name));

export type BodyKind = 'text' | 'image' | 'binary';

/** نوع المحتوى حسب Content-Type واسم الملف (لو معروف) */
export function classify(contentType: string | null, name: string): BodyKind {
  const ct = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (name && isImageName(name)) return 'image';
  if (name && isTextName(name)) return 'text';
  if (ct.startsWith('image/') && ct !== 'image/svg+xml') return 'image';
  if (
    ct === '' ||
    ct.startsWith('text/') ||
    ct.includes('json') ||
    ct.includes('javascript') ||
    ct.includes('xml') ||
    ct.includes('ecmascript') ||
    ct === 'application/x-sh' ||
    ct === 'application/typescript'
  ) {
    return 'text';
  }
  return 'binary';
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** تحويل بايتات إلى base64 (بدون الاعتماد على btoa/Buffer) */
export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    chunk += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    chunk += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    chunk += i + 2 < bytes.length ? B64[b2 & 63] : '=';
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

export function normalizeUrl(raw: string): string | null {
  let u = raw.trim();
  if (!u) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u)) u = 'https://' + u;
  return /^https?:\/\/[^\s/]+/i.test(u) ? u : null;
}

/** اسم الملف من آخر جزء في مسار الرابط (بدون ? و #) */
export function fileNameFromUrl(url: string): string {
  const noQuery = url.split('#')[0].split('?')[0];
  const path = noQuery.replace(/^[a-zA-Z]+:\/\/[^/]*/, '');
  const last = path.split('/').filter(Boolean).pop() ?? '';
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {
    name = last;
  }
  name = name.replace(/[\\/]/g, '_').trim();
  return name || 'index.html';
}

export class NetError extends Error {
  kind: 'offline' | 'timeout' | 'too_large';
  detail: string;
  constructor(kind: 'offline' | 'timeout' | 'too_large', detail = '') {
    super(kind + (detail ? ': ' + detail : ''));
    this.kind = kind;
    this.detail = detail;
    Object.setPrototypeOf(this, NetError.prototype);
  }
}

/** ينفّذ الطلب مع مهلة. بيرمي NetError لو مفيش اتصال أو انتهت المهلة */
export async function request(url: string, init: NetInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<NetResponse> {
  const f = getFetch();
  if (!f) throw new NetError('offline', 'fetch غير متاح');
  const g = globalThis as unknown as {
    AbortController?: new () => { signal: unknown; abort(): void };
    setTimeout: (cb: () => void, ms: number) => unknown;
    clearTimeout: (h: unknown) => void;
  };
  const ac = g.AbortController ? new g.AbortController() : null;
  let timer: unknown;
  let timedOut = false;
  const timeout = new Promise<never>((_, reject) => {
    timer = g.setTimeout(() => {
      timedOut = true;
      try {
        ac?.abort();
      } catch {
        /* تجاهل */
      }
      reject(new NetError('timeout'));
    }, timeoutMs);
  });
  try {
    const res = await Promise.race([f(url, { ...init, signal: ac ? ac.signal : undefined }), timeout]);
    const len = Number(res.headers.get('content-length') ?? '0');
    if (len > MAX_BYTES) throw new NetError('too_large', String(len));
    return res;
  } catch (e) {
    if (e instanceof NetError) throw e;
    if (timedOut) throw new NetError('timeout');
    throw new NetError('offline', e instanceof Error ? e.message : String(e));
  } finally {
    g.clearTimeout(timer);
  }
}

/** يقرأ الجسم حسب النوع، مع فحص الحجم. للنص: string، للصور: base64 */
export async function readBody(res: NetResponse, kind: 'text' | 'image'): Promise<{ data: string; bytes: number }> {
  if (kind === 'image') {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new NetError('too_large', String(buf.length));
    return { data: bytesToBase64(buf), bytes: buf.length };
  }
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new NetError('too_large', String(text.length));
  return { data: text, bytes: text.length };
}