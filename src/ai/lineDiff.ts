// src/ai/lineDiff.ts
// فرق الأسطر بين نسختين (للمعاينة قبل تطبيق تعديلات الذكاء الاصطناعي). منطق بحت.
export interface DiffOp {
  op: '+' | '-' | ' ';
  text: string;
}

const MAX_CELLS = 2_500_000; // حد حجم جدول LCS (بعده بنرجع لعدّ تقريبي)

const splitLines = (s: string): string[] => (s === '' ? [] : s.split(/\r?\n/));

// null لو الملفين كبار أوي للمقارنة التفصيلية
export function diffLines(a: string, b: string): DiffOp[] | null {
  const x = splitLines(a);
  const y = splitLines(b);
  let s = 0;
  while (s < x.length && s < y.length && x[s] === y[s]) s++;
  let ex = x.length;
  let ey = y.length;
  while (ex > s && ey > s && x[ex - 1] === y[ey - 1]) {
    ex--;
    ey--;
  }
  const mx = x.slice(s, ex);
  const my = y.slice(s, ey);
  if (mx.length * my.length > MAX_CELLS) return null;

  const n = mx.length;
  const m = my.length;
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = mx[i] === my[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const out: DiffOp[] = x.slice(0, s).map((text) => ({ op: ' ' as const, text }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (mx[i] === my[j]) {
      out.push({ op: ' ', text: mx[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) out.push({ op: '-', text: mx[i++] });
    else out.push({ op: '+', text: my[j++] });
  }
  while (i < n) out.push({ op: '-', text: mx[i++] });
  while (j < m) out.push({ op: '+', text: my[j++] });
  for (const text of x.slice(ex)) out.push({ op: ' ', text });
  return out;
}

// عدد الأسطر المضافة والمحذوفة (null = الملف مش موجود في الجهة دي)
export function countChanges(before: string | null, after: string | null): { add: number; del: number } {
  if (before === null) return { add: splitLines(after ?? '').length, del: 0 };
  if (after === null) return { add: 0, del: splitLines(before).length };
  const d = diffLines(before, after);
  if (!d) return { add: splitLines(after).length, del: splitLines(before).length };
  let add = 0;
  let del = 0;
  for (const o of d) {
    if (o.op === '+') add++;
    else if (o.op === '-') del++;
  }
  return { add, del };
}

// أسطر المعاينة: التغييرات مع سطرين سياق حواليها، وحد أقصى للعدد
export function previewLines(ops: DiffOp[], maxLines = 40, context = 2): { lines: DiffOp[]; more: number } {
  const keep = new Array<boolean>(ops.length).fill(false);
  ops.forEach((o, i) => {
    if (o.op === ' ') return;
    for (let k = Math.max(0, i - context); k <= Math.min(ops.length - 1, i + context); k++) keep[k] = true;
  });
  const all = ops.filter((_, i) => keep[i]);
  return { lines: all.slice(0, maxLines), more: Math.max(0, all.length - maxLines) };
}
