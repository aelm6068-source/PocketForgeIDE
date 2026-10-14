// أوامر البحث والنصوص: grep find sort uniq cut (كلها بتشتغل مع الأنابيب |)

import type { CmdCtx, Command } from '../types';
import { joinPath } from '../paths';
import { opts, parseCount, readAll, splitLines } from './fileCommands';

// ---------- أدوات مساعدة ----------
const IMAGE_RE = /\.(png|jpe?g|gif|webp|ico|bmp)$/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** نمط glob بسيط (* و ?) إلى تعبير نمطي */
function globToRegex(glob: string, ignoreCase: boolean): RegExp {
  const src = glob
    .split('')
    .map((ch) => (ch === '*' ? '.*' : ch === '?' ? '.' : escapeRegex(ch)))
    .join('');
  return new RegExp('^' + src + '$', ignoreCase ? 'i' : '');
}

function childShown(base: string, name: string): string {
  if (base === '') return name;
  return base === '/' ? '/' + name : base.endsWith('/') ? base + name : base + '/' + name;
}

/** مدخلات الأمر: الملفات المذكورة، أو الأنبوب (stdin) لو مفيش ملفات */
async function inputs(
  ctx: CmdCtx,
  cmd: string,
  files: string[]
): Promise<{ texts: { label: string; text: string }[]; failed: boolean }> {
  if (files.length === 0) return { texts: [{ label: '', text: ctx.stdin ?? '' }], failed: false };
  const r = await readAll(ctx, cmd, files);
  return { texts: r.items, failed: r.failed };
}

// ---------- grep ----------
interface GrepSource {
  label: string; // الاسم اللي بيظهر في الناتج ('' للأنبوب)
  text: string;
}

async function collectGrepFiles(
  ctx: CmdCtx,
  start: string,
  recursive: boolean,
  out: GrepSource[],
  shownStart: string = start
): Promise<boolean> {
  let failed = false;
  const visit = async (abs: string, shown: string, topLevel: boolean): Promise<void> => {
    const st = ctx.fs.stat(abs);
    if (!st) {
      ctx.err(`grep: ${ctx.t('term_err_not_found', { path: shown })}\n`);
      failed = true;
      return;
    }
    if (st.type === 'folder') {
      if (!recursive) {
        ctx.err(`grep: ${ctx.t('term_err_is_a_dir', { path: shown })}\n`);
        failed = true;
        return;
      }
      for (const e of ctx.fs.list(abs)) {
        await visit(joinPath(abs, e.name), childShown(shown, e.name), false);
      }
      return;
    }
    if (!topLevel && IMAGE_RE.test(st.name)) return; // نتجاهل الصور داخل -r
    out.push({ label: shown, text: await ctx.fs.readFile(abs) });
  };
  await visit(ctx.resolve(start), shownStart, true);
  return failed;
}

const grep: Command = async (ctx) => {
  const o = opts(ctx, 'grep', 'ivnclrFwEh', 'e');
  if (!o) return 2;
  const rest = [...o.rest];
  const pattern = o.values.e !== undefined ? o.values.e : rest.shift();
  if (pattern === undefined) {
    ctx.err(ctx.t('term_grep_missing_pattern') + '\n');
    return 2;
  }
  const word = o.flags.has('w');
  const body = o.flags.has('F') ? escapeRegex(pattern) : pattern;
  let re: RegExp;
  try {
    re = new RegExp(word ? `\\b(?:${body})\\b` : body, o.flags.has('i') ? 'i' : '');
  } catch {
    ctx.err(ctx.t('term_invalid_regex', { cmd: 'grep', value: pattern }) + '\n');
    return 2;
  }

  const recursive = o.flags.has('r');
  const sources: GrepSource[] = [];
  let errors = false;
  if (rest.length === 0 && recursive) {
    errors = await collectGrepFiles(ctx, '.', true, sources, '');
  } else if (rest.length === 0) {
    sources.push({ label: '', text: ctx.stdin ?? '' });
  } else {
    for (const f of rest) {
      if (await collectGrepFiles(ctx, f, recursive, sources)) errors = true;
    }
  }

  const showName = (rest.length > 1 || recursive) && !o.flags.has('h');
  const invert = o.flags.has('v');
  let matchedAny = false;
  for (const src of sources) {
    const prefix = showName && src.label ? src.label + ':' : '';
    let count = 0;
    const lines = splitLines(src.text);
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i]) === invert) continue;
      count++;
      matchedAny = true;
      if (o.flags.has('c') || o.flags.has('l')) continue;
      ctx.out(prefix + (o.flags.has('n') ? i + 1 + ':' : '') + lines[i] + '\n');
    }
    if (o.flags.has('l')) {
      if (count > 0) ctx.out((src.label || '(stdin)') + '\n');
    } else if (o.flags.has('c')) {
      ctx.out(prefix + count + '\n');
    }
  }
  if (errors) return 2;
  return matchedAny ? 0 : 1;
};

// ---------- find ----------
const find: Command = async (ctx) => {
  const args = ctx.args;
  const starts: string[] = [];
  let i = 0;
  while (i < args.length && !args[i].startsWith('-')) starts.push(args[i++]);
  if (starts.length === 0) starts.push('.');

  let nameRe: RegExp | null = null;
  let type: 'f' | 'd' | null = null;
  let maxDepth = Infinity;
  let minDepth = 0;
  while (i < args.length) {
    const a = args[i];
    const v = args[i + 1];
    if ((a === '-name' || a === '-iname') && v !== undefined) {
      nameRe = globToRegex(v, a === '-iname');
    } else if (a === '-type' && (v === 'f' || v === 'd')) {
      type = v;
    } else if ((a === '-maxdepth' || a === '-mindepth') && v !== undefined) {
      const n = parseCount(ctx, 'find', v, 0);
      if (n === null) return 1;
      if (a === '-maxdepth') maxDepth = n;
      else minDepth = n;
    } else {
      ctx.err(ctx.t('term_find_bad_expr', { opt: a }) + '\n');
      return 1;
    }
    i += 2;
  }

  let code = 0;
  const visit = (abs: string, shown: string, name: string, depth: number): void => {
    const st = ctx.fs.stat(abs);
    if (!st) return;
    const isDir = st.type === 'folder';
    const nameOk = !nameRe || nameRe.test(name);
    const typeOk = !type || (type === 'd') === isDir;
    if (depth >= minDepth && nameOk && typeOk) ctx.out(shown + '\n');
    if (isDir && depth < maxDepth) {
      for (const e of ctx.fs.list(abs)) {
        visit(joinPath(abs, e.name), childShown(shown, e.name), e.name, depth + 1);
      }
    }
  };
  for (const s of starts) {
    const abs = ctx.resolve(s);
    const st = ctx.fs.stat(abs);
    if (!st) {
      ctx.err(`find: ${ctx.t('term_err_not_found', { path: s })}\n`);
      code = 1;
      continue;
    }
    const shown = s.length > 1 ? s.replace(/\/+$/, '') || '/' : s;
    visit(abs, shown, st.isRoot ? '/' : st.name, 0);
  }
  return code;
};

// ---------- sort ----------
const sort: Command = async (ctx) => {
  const o = opts(ctx, 'sort', 'rnuf');
  if (!o) return 1;
  const { texts, failed } = await inputs(ctx, 'sort', o.rest);
  let lines: string[] = [];
  for (const t of texts) lines = lines.concat(splitLines(t.text));
  const fold = o.flags.has('f');
  const key = (s: string): string => (fold ? s.toLowerCase() : s);
  const num = (s: string): number => {
    const m = /^\s*(-?\d+(?:\.\d+)?)/.exec(s);
    return m ? parseFloat(m[1]) : 0;
  };
  const cmp = (a: string, b: string): number => {
    if (o.flags.has('n')) {
      const d = num(a) - num(b);
      if (d !== 0) return d;
    }
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
  lines.sort(cmp);
  if (o.flags.has('r')) lines.reverse();
  if (o.flags.has('u')) lines = lines.filter((l, idx) => idx === 0 || cmp(lines[idx - 1], l) !== 0);
  if (lines.length) ctx.out(lines.join('\n') + '\n');
  return failed ? 2 : 0;
};

// ---------- uniq ----------
const uniq: Command = async (ctx) => {
  const o = opts(ctx, 'uniq', 'cdui');
  if (!o) return 1;
  const { texts, failed } = await inputs(ctx, 'uniq', o.rest.slice(0, 1));
  const lines = splitLines(texts[0]?.text ?? '');
  const fold = o.flags.has('i');
  const groups: { line: string; n: number }[] = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    if (last && (fold ? last.line.toLowerCase() === l.toLowerCase() : last.line === l)) last.n++;
    else groups.push({ line: l, n: 1 });
  }
  for (const g of groups) {
    if (o.flags.has('d') && g.n < 2) continue;
    if (o.flags.has('u') && g.n > 1) continue;
    ctx.out((o.flags.has('c') ? String(g.n).padStart(7) + ' ' : '') + g.line + '\n');
  }
  return failed ? 1 : 0;
};

// ---------- cut ----------
type Range = [number, number];

function parseRanges(spec: string): Range[] | null {
  const out: Range[] = [];
  for (const part of spec.split(',')) {
    const m = /^(\d*)-(\d*)$/.exec(part);
    if (m && (m[1] || m[2])) {
      out.push([m[1] ? parseInt(m[1], 10) : 1, m[2] ? parseInt(m[2], 10) : Infinity]);
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      out.push([n, n]);
    } else {
      return null;
    }
  }
  return out.some((r) => r[0] < 1) ? null : out;
}

const inRanges = (n: number, rs: Range[]): boolean => rs.some((r) => n >= r[0] && n <= r[1]);

const cut: Command = async (ctx) => {
  const o = opts(ctx, 'cut', 's', 'dfc');
  if (!o) return 1;
  const spec = o.values.f ?? o.values.c;
  if (spec === undefined) {
    ctx.err(ctx.t('term_cut_missing_list') + '\n');
    return 1;
  }
  const ranges = parseRanges(spec);
  if (!ranges) {
    ctx.err(ctx.t('term_invalid_list', { cmd: 'cut', value: spec }) + '\n');
    return 1;
  }
  const delim = o.values.d !== undefined ? o.values.d : '\t';
  const byChars = o.values.f === undefined;
  const { texts, failed } = await inputs(ctx, 'cut', o.rest);
  for (const t of texts) {
    for (const line of splitLines(t.text)) {
      if (byChars) {
        ctx.out(Array.from(line).filter((_, idx) => inRanges(idx + 1, ranges)).join('') + '\n');
      } else if (!line.includes(delim)) {
        if (!o.flags.has('s')) ctx.out(line + '\n');
      } else {
        ctx.out(
          line
            .split(delim)
            .filter((_, idx) => inRanges(idx + 1, ranges))
            .join(delim) + '\n'
        );
      }
    }
  }
  return failed ? 1 : 0;
};

export const TEXT_COMMANDS: Record<string, Command> = { grep, find, sort, uniq, cut };