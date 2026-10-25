// src/github/zipReader.ts
// قارئ ZIP بسيط من غير أي مكتبة خارجية: بيقرا فهرس الملفات (central directory)
// وبيفك ضغط كل ملف (stored أو deflate) مع التأكد من سلامته بـ CRC32.
// مش بيدعم: ZIP64 (ملفات فوق 4 جيجا)، التشفير، وطرق ضغط غير deflate/stored.
import { utf8Decode } from './codec';

export type ZipErrorCode = 'bad_zip' | 'unsupported';

export class ZipError extends Error {
  code: ZipErrorCode;
  constructor(code: ZipErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ZipError';
    this.code = code;
  }
}

const bad = (msg: string): ZipError => new ZipError('bad_zip', msg);

// ---------------------------------------------------------------- inflate (RFC 1951)
const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface HuffTable {
  table: Int32Array;
  bits: number;
}

// جدول بحث مباشر: الفهرس = أول `bits` بت من الدفق (بترتيب القراءة)، والقيمة = (طول الكود << 16) | الرمز
function buildTable(lengths: ArrayLike<number>, n: number): HuffTable {
  let max = 0;
  const count = new Int32Array(16);
  for (let i = 0; i < n; i++) {
    const l = lengths[i];
    count[l]++;
    if (l > max) max = l;
  }
  if (max === 0) return { table: new Int32Array(1), bits: 0 };
  count[0] = 0;
  const next = new Int32Array(17);
  let code = 0;
  for (let b = 1; b <= max; b++) {
    code = (code + count[b - 1]) << 1;
    next[b] = code;
  }
  const size = 1 << max;
  const table = new Int32Array(size);
  for (let sym = 0; sym < n; sym++) {
    const len = lengths[sym];
    if (len === 0) continue;
    const c = next[len]++;
    let rev = 0;
    for (let i = 0; i < len; i++) if (c & (1 << i)) rev |= 1 << (len - 1 - i);
    const entry = (len << 16) | sym;
    for (let j = rev; j < size; j += 1 << len) table[j] = entry;
  }
  return { table, bits: max };
}

let fixedLit: HuffTable | null = null;
let fixedDist: HuffTable | null = null;
function fixedTables(): { lit: HuffTable; dist: HuffTable } {
  if (!fixedLit || !fixedDist) {
    const l = new Uint8Array(288);
    for (let i = 0; i < 144; i++) l[i] = 8;
    for (let i = 144; i < 256; i++) l[i] = 9;
    for (let i = 256; i < 280; i++) l[i] = 7;
    for (let i = 280; i < 288; i++) l[i] = 8;
    fixedLit = buildTable(l, 288);
    fixedDist = buildTable(new Uint8Array(30).fill(5), 30);
  }
  return { lit: fixedLit, dist: fixedDist };
}

// بيفك deflate خام. expectedSize معروف مسبقًا من فهرس الـ ZIP، فبنحجز الناتج مرة واحدة
// وأي محاولة تكتب أكتر منه بتعتبر ملف تالف (ده كمان بيحمينا من "قنبلة ضغط").
export function inflateRaw(src: Uint8Array, expectedSize: number): Uint8Array {
  const out = new Uint8Array(expectedSize);
  let outPos = 0;
  let pos = 0;
  let bitBuf = 0;
  let bitCnt = 0;
  const srcLen = src.length;

  const fill = (need: number): void => {
    while (bitCnt < need) {
      // بعد نهاية البيانات بنغذّي أصفار، وبنتأكد في آخر كل بلوك إننا ما استهلكناهاش
      bitBuf |= (pos < srcLen ? src[pos] : 0) << bitCnt;
      pos++;
      bitCnt += 8;
    }
  };
  const getBits = (n: number): number => {
    if (n === 0) return 0;
    fill(n);
    const v = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCnt -= n;
    return v;
  };
  const decode = (t: HuffTable): number => {
    if (t.bits === 0) throw bad('empty huffman table');
    fill(t.bits);
    const e = t.table[bitBuf & ((1 << t.bits) - 1)];
    if (e === 0) throw bad('invalid huffman code');
    const len = e >>> 16;
    bitBuf >>>= len;
    bitCnt -= len;
    return e & 0xffff;
  };
  const checkOverrun = (): void => {
    if (pos * 8 - bitCnt > srcLen * 8) throw bad('unexpected end of data');
  };

  let final = false;
  while (!final) {
    final = getBits(1) === 1;
    const type = getBits(2);
    if (type === 0) {
      // stored: نرجع للبايت اللي بعد البتات المتبقية
      pos -= bitCnt >> 3;
      bitBuf = 0;
      bitCnt = 0;
      if (pos + 4 > srcLen) throw bad('truncated stored block');
      const len = src[pos] | (src[pos + 1] << 8);
      const nlen = src[pos + 2] | (src[pos + 3] << 8);
      if ((len ^ 0xffff) !== nlen) throw bad('stored block length mismatch');
      pos += 4;
      if (pos + len > srcLen) throw bad('truncated stored block');
      if (outPos + len > out.length) throw bad('output larger than declared size');
      out.set(src.subarray(pos, pos + len), outPos);
      outPos += len;
      pos += len;
    } else if (type === 1 || type === 2) {
      let lit: HuffTable;
      let dist: HuffTable;
      if (type === 1) {
        const f = fixedTables();
        lit = f.lit;
        dist = f.dist;
      } else {
        const hlit = getBits(5) + 257;
        const hdist = getBits(5) + 1;
        const hclen = getBits(4) + 4;
        if (hlit > 286 || hdist > 30) throw bad('too many codes');
        const cl = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) cl[CL_ORDER[i]] = getBits(3);
        const clTable = buildTable(cl, 19);
        const lengths = new Uint8Array(hlit + hdist);
        let i = 0;
        while (i < hlit + hdist) {
          const sym = decode(clTable);
          if (sym < 16) {
            lengths[i++] = sym;
          } else {
            let rep: number;
            let val = 0;
            if (sym === 16) {
              if (i === 0) throw bad('repeat with no previous length');
              val = lengths[i - 1];
              rep = 3 + getBits(2);
            } else if (sym === 17) {
              rep = 3 + getBits(3);
            } else {
              rep = 11 + getBits(7);
            }
            if (i + rep > hlit + hdist) throw bad('too many lengths');
            while (rep-- > 0) lengths[i++] = val;
          }
        }
        lit = buildTable(lengths.subarray(0, hlit), hlit);
        dist = buildTable(lengths.subarray(hlit), hdist);
      }
      for (;;) {
        const sym = decode(lit);
        if (sym < 256) {
          if (outPos >= out.length) throw bad('output larger than declared size');
          out[outPos++] = sym;
        } else if (sym === 256) {
          break;
        } else {
          const li = sym - 257;
          if (li >= 29) throw bad('invalid length symbol');
          const length = LEN_BASE[li] + getBits(LEN_EXTRA[li]);
          const ds = decode(dist);
          if (ds >= 30) throw bad('invalid distance symbol');
          const distance = DIST_BASE[ds] + getBits(DIST_EXTRA[ds]);
          if (distance > outPos) throw bad('distance too far back');
          if (outPos + length > out.length) throw bad('output larger than declared size');
          // النسخ بايت بايت (المصدر والهدف ممكن يتداخلوا عمدًا)
          let from = outPos - distance;
          for (let k = 0; k < length; k++) out[outPos++] = out[from++];
        }
      }
    } else {
      throw bad('invalid block type');
    }
    checkOverrun();
  }
  if (outPos !== out.length) throw bad('output smaller than declared size');
  return out;
}

// ---------------------------------------------------------------- crc32
let crcTable: Int32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

// ---------------------------------------------------------------- zip container
export interface ZipEntry {
  name: string;
  isDir: boolean;
  // الحجم بعد فك الضغط
  size: number;
  compressedSize: number;
  method: number;
  crc: number;
  offset: number;
}

const u16 = (d: Uint8Array, p: number): number => d[p] | (d[p + 1] << 8);
const u32 = (d: Uint8Array, p: number): number => (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24)) >>> 0;

function decodeName(raw: Uint8Array): string {
  const utf = utf8Decode(raw);
  if (utf !== null) return utf;
  // ترميز قديم (CP437/Latin-1): أقرب حاجة معقولة
  let s = '';
  for (let i = 0; i < raw.length; i++) s += String.fromCharCode(raw[i]);
  return s;
}

export function listZip(data: Uint8Array): ZipEntry[] {
  if (data.length < 22) throw bad('file too small');
  // نبحث عن نهاية الفهرس (EOCD) من آخر الملف (التعليق ممكن يوصل 65535 بايت)
  let eocd = -1;
  const stop = Math.max(0, data.length - 22 - 65535);
  for (let p = data.length - 22; p >= stop; p--) {
    if (data[p] === 0x50 && data[p + 1] === 0x4b && data[p + 2] === 0x05 && data[p + 3] === 0x06) {
      eocd = p;
      break;
    }
  }
  if (eocd < 0) throw bad('end of central directory not found');
  const total = u16(data, eocd + 10);
  const cdSize = u32(data, eocd + 12);
  const cdOffset = u32(data, eocd + 16);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new ZipError('unsupported', 'zip64');
  }
  if (cdOffset + cdSize > data.length) throw bad('central directory out of range');

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (p + 46 > data.length || u32(data, p) !== 0x02014b50) throw bad('bad central directory entry');
    const flags = u16(data, p + 8);
    const method = u16(data, p + 10);
    const crc = u32(data, p + 16);
    const compressedSize = u32(data, p + 20);
    const size = u32(data, p + 24);
    const nameLen = u16(data, p + 28);
    const extraLen = u16(data, p + 30);
    const commentLen = u16(data, p + 32);
    const offset = u32(data, p + 42);
    if (p + 46 + nameLen > data.length) throw bad('truncated entry name');
    const name = decodeName(data.subarray(p + 46, p + 46 + nameLen));
    if (flags & 1) throw new ZipError('unsupported', 'encrypted zip');
    entries.push({ name, isDir: name.endsWith('/'), size, compressedSize, method, crc, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function readEntry(data: Uint8Array, e: ZipEntry): Uint8Array {
  const o = e.offset;
  if (o + 30 > data.length || u32(data, o) !== 0x04034b50) throw bad('bad local header for ' + e.name);
  const start = o + 30 + u16(data, o + 26) + u16(data, o + 28);
  if (start + e.compressedSize > data.length) throw bad('entry data out of range: ' + e.name);
  const raw = data.subarray(start, start + e.compressedSize);
  let out: Uint8Array;
  if (e.method === 0) {
    if (e.compressedSize !== e.size) throw bad('stored size mismatch: ' + e.name);
    out = raw;
  } else if (e.method === 8) {
    out = inflateRaw(raw, e.size);
  } else {
    throw new ZipError('unsupported', 'compression method ' + e.method);
  }
  if (crc32(out) !== e.crc) throw bad('crc mismatch: ' + e.name);
  return out;
}