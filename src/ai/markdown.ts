// src/ai/markdown.ts
// تحليل بسيط لرد الذكاء الاصطناعي (دوال نقية): مربعات الكود، العناوين، القوايم، **عريض** و `كود`.
export type Block = { type: 'text'; text: string } | { type: 'code'; code: string; lang: string };
export interface Span {
  text: string;
  bold?: boolean;
  code?: boolean;
}

// بيقسّم النص لنص عادي ومربعات كود (```lang ... ```). مربع كود مقفولش بيعتبر لحد آخر النص.
export function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let text: string[] = [];
  let code: string[] | null = null;
  let lang = '';
  const flushText = () => {
    const t = text.join('\n').replace(/^\n+|\n+$/g, '');
    if (t) blocks.push({ type: 'text', text: t });
    text = [];
  };
  for (const line of lines) {
    const fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/);
    if (code === null) {
      if (fence) {
        flushText();
        code = [];
        lang = fence[1] ?? '';
      } else text.push(line);
    } else if (fence && !fence[1]) {
      blocks.push({ type: 'code', code: code.join('\n'), lang });
      code = null;
    } else code.push(line);
  }
  if (code !== null) blocks.push({ type: 'code', code: code.join('\n'), lang });
  else flushText();
  return blocks;
}

// سطر واحد: عناوين (#) بتتحول لعريض، "* " و"- " لنقطة، وبعدين **عريض** و `كود`
export function parseLine(line: string): Span[] {
  let l = line;
  const h = l.match(/^\s{0,3}#{1,6}\s+(.*)$/);
  if (h) return parseInline(h[1]).map((s) => ({ ...s, bold: true }));
  l = l.replace(/^(\s*)[*-]\s+/, '$1• ');
  return parseInline(l);
}

export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) spans.push({ text: tok.slice(2, -2), bold: true });
    else spans.push({ text: tok.slice(1, -1), code: true });
    last = m.index + tok.length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length ? spans : [{ text: '' }];
}