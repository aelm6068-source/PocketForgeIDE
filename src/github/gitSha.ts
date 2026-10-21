// src/github/gitSha.ts
// بيحسب نفس الـ SHA اللي git بيحسبه للملف (blob sha) محليًا، عشان نعرف أي
// ملفات اتغيرت من غير ما نرفع كل حاجة من جديد، ونقارن مع اللي على GitHub.
// الصيغة: sha1("blob <حجم البايتات>\0" + البايتات). منطق صرف من غير مكتبات.

// نص -> بايتات UTF-8 (من غير TextEncoder عشان يشتغل في أي بيئة). بنعدّي مرتين:
// الأولى نحسب الحجم، والتانية نملى Uint8Array جاهزة (أوفر في الذاكرة من مصفوفة عادية)
function codePointAt(text: string, i: number): { cp: number; units: number } {
  const c = text.charCodeAt(i);
  if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
    const next = text.charCodeAt(i + 1);
    if (next >= 0xdc00 && next <= 0xdfff) {
      return { cp: 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00), units: 2 };
    }
  }
  // surrogate يتيم (غير صالح) بيتحول لـ U+FFFD زي ما Node و git بيعملوا
  return { cp: c >= 0xd800 && c <= 0xdfff ? 0xfffd : c, units: 1 };
}

export function utf8Bytes(text: string): Uint8Array {
  let size = 0;
  for (let i = 0; i < text.length; ) {
    const { cp, units } = codePointAt(text, i);
    size += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    i += units;
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (let i = 0; i < text.length; ) {
    const { cp, units } = codePointAt(text, i);
    if (cp < 0x80) out[o++] = cp;
    else if (cp < 0x800) {
      out[o++] = 0xc0 | (cp >> 6);
      out[o++] = 0x80 | (cp & 63);
    } else if (cp < 0x10000) {
      out[o++] = 0xe0 | (cp >> 12);
      out[o++] = 0x80 | ((cp >> 6) & 63);
      out[o++] = 0x80 | (cp & 63);
    } else {
      out[o++] = 0xf0 | (cp >> 18);
      out[o++] = 0x80 | ((cp >> 12) & 63);
      out[o++] = 0x80 | ((cp >> 6) & 63);
      out[o++] = 0x80 | (cp & 63);
    }
    i += units;
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64[i]] = i;

// base64 -> بايتات
export function base64Bytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64_LOOKUP[clean[i]];
    const b = B64_LOOKUP[clean[i + 1]];
    const c = i + 2 < len ? B64_LOOKUP[clean[i + 2]] : 0;
    const d = i + 3 < len ? B64_LOOKUP[clean[i + 3]] : 0;
    if (o < out.length) out[o++] = (a << 2) | (b >> 4);
    if (o < out.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (o < out.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}

function rotl(x: number, n: number): number {
  return (x << n) | (x >>> (32 - n));
}

export function sha1Hex(data: Uint8Array): string {
  const len = data.length;
  const total = (((len + 8) >> 6) + 1) << 6; // الحجم بعد الحشو، مضاعف 64
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const bitsHigh = Math.floor(len / 0x20000000);
  const bitsLow = (len << 3) >>> 0;
  buf[total - 8] = (bitsHigh >>> 24) & 255;
  buf[total - 7] = (bitsHigh >>> 16) & 255;
  buf[total - 6] = (bitsHigh >>> 8) & 255;
  buf[total - 5] = bitsHigh & 255;
  buf[total - 4] = (bitsLow >>> 24) & 255;
  buf[total - 3] = (bitsLow >>> 16) & 255;
  buf[total - 2] = (bitsLow >>> 8) & 255;
  buf[total - 1] = bitsLow & 255;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Int32Array(80);

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3];
    }
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

// blob sha لمحتوى ملف (نص utf-8 أو صورة base64)
export function gitBlobSha(content: string, encoding: 'utf-8' | 'base64'): string {
  const body = encoding === 'base64' ? base64Bytes(content) : utf8Bytes(content);
  const header = utf8Bytes(`blob ${body.length}\0`);
  const all = new Uint8Array(header.length + body.length);
  all.set(header);
  all.set(body, header.length);
  return sha1Hex(all);
}