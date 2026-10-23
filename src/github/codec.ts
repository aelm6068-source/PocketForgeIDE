// src/github/codec.ts
// تحويل محتوى ملف نازل من GitHub (base64) للشكل اللي بيتخزن بيه في المشروع:
// نص عادي (utf-8) أو صورة (base64 خام). أي حاجة تانية (ملف ثنائي) مش مدعومة هنا.
import { findSecretInText } from './ignore';
import { base64Bytes } from './gitSha';
import { isImageName } from '../terminal/net';

// بايتات UTF-8 -> نص. بترجّع null لو البايتات مش UTF-8 سليم (يعني الملف ثنائي).
// صارمة قصدًا: لو فكّينا بايتات غلط هنغيّر المحتوى، وبعدين الـ sha هيختلف عن GitHub.
export function utf8Decode(bytes: Uint8Array): string | null {
  const parts: string[] = [];
  let units: number[] = [];
  const flush = () => {
    if (units.length > 0) {
      parts.push(String.fromCharCode.apply(null, units));
      units = [];
    }
  };
  const n = bytes.length;
  let i = 0;
  while (i < n) {
    const b0 = bytes[i];
    let cp: number;
    if (b0 < 0x80) {
      cp = b0;
      i += 1;
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      if (i + 1 >= n || (bytes[i + 1] & 0xc0) !== 0x80) return null;
      cp = ((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      i += 2;
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      if (i + 2 >= n) return null;
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) return null;
      cp = ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f);
      if (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff)) return null;
      i += 3;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      if (i + 3 >= n) return null;
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      const b3 = bytes[i + 3];
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) return null;
      cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      if (cp < 0x10000 || cp > 0x10ffff) return null;
      i += 4;
    } else {
      return null;
    }
    if (cp >= 0x10000) {
      const c = cp - 0x10000;
      units.push(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
    } else {
      units.push(cp);
    }
    if (units.length >= 8192) flush();
  }
  flush();
  return parts.join('');
}

export type DecodedBlob =
  | { ok: true; content: string; encoding: 'utf-8' | 'base64' }
  | { ok: false; reason: 'binary' | 'secret' };

// b64 = محتوى الـ blob زي ما GitHub بيرجّعه (base64 وفيه فواصل أسطر)
export function decodeBlob(path: string, b64: string): DecodedBlob {
  const clean = b64.replace(/\s+/g, '');
  if (isImageName(path)) return { ok: true, content: clean, encoding: 'base64' };
  const text = utf8Decode(base64Bytes(clean));
  if (text === null) return { ok: false, reason: 'binary' };
  if (findSecretInText(text) !== null) return { ok: false, reason: 'secret' };
  return { ok: true, content: text, encoding: 'utf-8' };
}