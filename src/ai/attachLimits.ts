// src/ai/attachLimits.ts
// حدود وقواعد المرفقات من الجهاز (ملفات / صور / فيديو). منطق بحت من غير مكتبات native.
export const MB = 1024 * 1024;
export const MAX_FILE_BYTES = 100 * MB; // أكبر ملف نقدر نختاره
export const MAX_IMAGE_BYTES = 20 * MB;
export const MAX_VIDEO_BYTES = 50 * MB;
export const HEAD_BYTES = 120_000; // الي بنقراه فعليًا من الملف الكبير (أول جزء بس بيتبعت للموديل)
export const MAX_IMAGES = 8; // إجمالي الصور + لقطات الفيديو في الرسالة الواحدة
export const IMAGE_MAX_DIM = 1600; // بنصغّر الصورة لحد ده قبل الإرسال
export const MAX_IMAGE_B64 = 4_000_000; // حوالي 3 ميجا بعد الضغط (أقل من حد Anthropic)
export const VIDEO_FRAMES = 6;

export type MediaKind = 'image' | 'video' | 'file';

export function kindOf(mime: string | undefined, name: string): MediaKind {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'mkv', 'webm', '3gp', 'avi', 'm4v'].includes(ext)) return 'video';
  return 'file';
}

export function sizeOk(kind: MediaKind, size: number | undefined): boolean {
  if (typeof size !== 'number') return true; // مجهول: هنقرر بعد القراءة
  const max = kind === 'image' ? MAX_IMAGE_BYTES : kind === 'video' ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
  return size <= max;
}

// أوقات (ms) أخد لقطات الفيديو: بنبدأ من الأول وبنوسّع (من غير ما نعرف المدة)
const FRAME_TIMES = [300, 2000, 5000, 10000, 20000, 40000, 60000, 90000];
export function frameTimes(n: number): number[] {
  return FRAME_TIMES.slice(0, Math.max(0, Math.min(n, FRAME_TIMES.length)));
}

// بصمة بسيطة للقطة علشان نشيل المكرر (فيديو أقصر من وقت اللقطة بيرجّع نفس اللقطة)
export function frameKey(b64: string): string {
  return `${b64.length}:${b64.slice(0, 48)}:${b64.slice(-48)}`;
}

export function truncNote(size: number | undefined): string {
  const mb = typeof size === 'number' ? (size / MB).toFixed(size >= 10 * MB ? 0 : 1) : '?';
  return `\n\n[... الملف كبير (${mb} MB): اتقرا أول جزء بس ...]`;
}
