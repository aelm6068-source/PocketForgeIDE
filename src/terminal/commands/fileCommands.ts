// أوامر الملفات: pwd cd ls cat echo mkdir touch rm cp mv head tail wc tree clear history help

import { FsError } from '../types';
import type { CmdCtx, Command } from '../types';
import { joinPath } from '../paths';
import { isImageName } from '../net';

// ---------- أدوات مساعدة ----------
/** الحجم الحقيقي بالبايت: الصور مخزّنة كنص base64 فنحسب حجمها الأصلي */
export function byteSize(path: string, text: string): number {
  if (!isImageName(path)) return text.length;
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((text.length * 3) / 4) - pad);
}

export interface Parsed {
  flags: Set<string>;
  values: Record<string, string>;
  rest: string[];
}

export function opts(ctx: CmdCtx, cmd: string, bools: string, valued = ''): Parsed | null {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const rest: string[] = [];
  const args = ctx.args;
  let bad: string | undefined;
  let done = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (done || a === '-' || !a.startsWith('-')) {
      rest.push(a);
      continue;
    }
    if (a === '--') {
      done = true;
      continue;
    }
    if (a.startsWith('--')) {
      bad = bad ?? a;
      continue;
    }
    if (/^-\d+$/.test(a) && valued.includes('n')) {
      values.n = a.slice(1);
      continue;
    }
    for (let j = 1; j < a.length; j++) {
      const ch = a[j];
      if (bools.includes(ch)) {
        flags.add(ch);
      } else if (valued.includes(ch)) {
        const rem = a.slice(j + 1);
        values[ch] = rem ? rem : args[++i] ?? '';
        break;
      } else {
        bad = bad ?? '-' + ch;
      }
    }
  }
  if (bad) {
    ctx.err(ctx.t('term_invalid_option', { cmd, opt: bad }) + '\n');
    return null;
  }
  return { flags, values, rest };
}

export function report(ctx: CmdCtx, cmd: string, arg: string, e: unknown): void {
  if (!(e instanceof FsError)) throw e;
  const shown = e.path === ctx.resolve(arg) ? arg : e.path;
  ctx.err(`${cmd}: ${ctx.t('term_err_' + e.code, { path: shown })}\n`);
}

export function splitLines(text: string): string[] {
  if (!text) return [];
  const parts = text.split('\n');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

export async function readAll(
  ctx: CmdCtx,
  cmd: string,
  paths: string[]
): Promise<{ items: { label: string; text: string }[]; failed: boolean }> {
  const items: { label: string; text: string }[] = [];
  let failed = false;
  for (const p of paths) {
    try {
      items.push({ label: p, text: await ctx.fs.readFile(ctx.resolve(p)) });
    } catch (e) {
      report(ctx, cmd, p, e);
      failed = true;
    }
  }
  return { items, failed };
}

export function parseCount(ctx: CmdCtx, cmd: string, raw: string | undefined, fallback: number): number | null {
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) {
    ctx.err(ctx.t('term_invalid_number', { cmd, value: raw }) + '\n');
    return null;
  }
  return parseInt(raw, 10);
}

// ---------- الأوامر ----------
const pwd: Command = async (ctx) => {
  ctx.out(ctx.shell.cwd + '\n');
  return 0;
};

const cd: Command = async (ctx) => {
  const arg = ctx.args[0] ?? '/';
  const abs = ctx.resolve(arg);
  const st = ctx.fs.stat(abs);
  if (!st) {
    ctx.err(`cd: ${ctx.t('term_err_not_found', { path: arg })}\n`);
    return 1;
  }
  if (st.type !== 'folder') {
    ctx.err(`cd: ${ctx.t('term_err_not_a_dir', { path: arg })}\n`);
    return 1;
  }
  ctx.shell.cwd = abs;
  return 0;
};

const ls: Command = async (ctx) => {
  const o = opts(ctx, 'ls', 'la');
  if (!o) return 2;
  const long = o.flags.has('l');
  const paths = o.rest.length ? o.rest : ['.'];
  let code = 0;

  const fmt = async (dirAbs: string, name: string, type: 'file' | 'folder'): Promise<string> => {
    const label = name + (type === 'folder' ? '/' : '');
    if (!long) return label;
    let size = '-';
        if (type === 'file') {
      const full = joinPath(dirAbs, name);
      size = String(byteSize(full, await ctx.fs.readFile(full)));
        }
    return `${type === 'folder' ? 'd' : '-'} ${size.padStart(7)} ${label}`;
  };

  let printed = false;
  for (const arg of paths) {
    const abs = ctx.resolve(arg);
    const st = ctx.fs.stat(abs);
    if (!st) {
      ctx.err(`ls: ${ctx.t('term_err_not_found', { path: arg })}\n`);
      code = 1;
      continue;
    }
    if (st.type === 'file') {
      const parent = abs.slice(0, abs.lastIndexOf('/')) || '/';
      ctx.out((await fmt(parent, st.name, 'file')) + '\n');
      printed = true;
      continue;
    }
    if (paths.length > 1) ctx.out(`${printed ? '\n' : ''}${arg}:\n`);
    printed = true;
    for (const e of ctx.fs.list(abs)) ctx.out((await fmt(abs, e.name, e.type)) + '\n');
  }
  return code;
};

const cat: Command = async (ctx) => {
  const o = opts(ctx, 'cat', 'n');
  if (!o) return 2;
  const number = o.flags.has('n');
  let n = 0;
  const emit = (text: string): void => {
    if (!number) {
      ctx.out(text);
      return;
    }
    for (const line of splitLines(text)) ctx.out(`${String(++n).padStart(6)}\t${line}\n`);
  };
  if (!o.rest.length) {
    if (ctx.stdin !== null) emit(ctx.stdin);
    return 0;
  }
  let code = 0;
  for (const p of o.rest) {
    try {
            const abs = ctx.resolve(p);
      const text = await ctx.fs.readFile(abs);
      if (isImageName(abs)) {
        ctx.err(ctx.t('term_cat_image', { path: p, bytes: byteSize(abs, text) }) + '\n');
        code = 1;
        continue;
      }
      emit(text);
    } catch (e) {
      report(ctx, 'cat', p, e);
      code = 1;
    }
  }
  return code;
};

const echo: Command = async (ctx) => {
  const args = [...ctx.args];
  let newline = true;
  let escapes = false;
  while (args.length && /^-[ne]+$/.test(args[0])) {
    const f = args.shift() as string;
    if (f.includes('n')) newline = false;
    if (f.includes('e')) escapes = true;
  }
  let text = args.join(' ');
  if (escapes) text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  ctx.out(text + (newline ? '\n' : ''));
  return 0;
};

const mkdir: Command = async (ctx) => {
  const o = opts(ctx, 'mkdir', 'p');
  if (!o) return 2;
  if (!o.rest.length) {
    ctx.err(ctx.t('term_missing_operand', { cmd: 'mkdir' }) + '\n');
    return 1;
  }
  let code = 0;
  for (const p of o.rest) {
    try {
      await ctx.fs.mkdir(ctx.resolve(p), o.flags.has('p'));
    } catch (e) {
      report(ctx, 'mkdir', p, e);
      code = 1;
    }
  }
  return code;
};

const touch: Command = async (ctx) => {
  if (!ctx.args.length) {
    ctx.err(ctx.t('term_missing_operand', { cmd: 'touch' }) + '\n');
    return 1;
  }
  let code = 0;
  for (const p of ctx.args) {
    try {
      const abs = ctx.resolve(p);
      if (!ctx.fs.stat(abs)) await ctx.fs.writeFile(abs, '');
    } catch (e) {
      report(ctx, 'touch', p, e);
      code = 1;
    }
  }
  return code;
};

const rm: Command = async (ctx) => {
  const o = opts(ctx, 'rm', 'rRf');
  if (!o) return 2;
  if (!o.rest.length) {
    if (o.flags.has('f')) return 0;
    ctx.err(ctx.t('term_missing_operand', { cmd: 'rm' }) + '\n');
    return 1;
  }
  const recursive = o.flags.has('r') || o.flags.has('R');
  const force = o.flags.has('f');
  let code = 0;
  for (const p of o.rest) {
    const abs = ctx.resolve(p);
    if (!ctx.fs.stat(abs)) {
      if (!force) {
        ctx.err(`rm: ${ctx.t('term_err_not_found', { path: p })}\n`);
        code = 1;
      }
      continue;
    }
    try {
      await ctx.fs.remove(abs, recursive);
    } catch (e) {
      report(ctx, 'rm', p, e);
      code = 1;
    }
  }
  return code;
};

function transfer(cmd: 'cp' | 'mv'): Command {
  return async (ctx) => {
    const o = opts(ctx, cmd, cmd === 'cp' ? 'rR' : '');
    if (!o) return 2;
    if (o.rest.length < 2) {
      ctx.err(ctx.t('term_missing_operand', { cmd }) + '\n');
      return 1;
    }
    const dstArg = o.rest[o.rest.length - 1];
    const srcs = o.rest.slice(0, -1);
    const dst = ctx.resolve(dstArg);
    if (srcs.length > 1 && ctx.fs.stat(dst)?.type !== 'folder') {
      ctx.err(`${cmd}: ${ctx.t('term_err_not_a_dir', { path: dstArg })}\n`);
      return 1;
    }
    const recursive = o.flags.has('r') || o.flags.has('R');
    let code = 0;
    for (const s of srcs) {
      try {
        if (cmd === 'cp') await ctx.fs.copy(ctx.resolve(s), dst, recursive);
        else await ctx.fs.move(ctx.resolve(s), dst);
      } catch (e) {
        report(ctx, cmd, s, e);
        code = 1;
      }
    }
    return code;
  };
}

function headTail(cmd: 'head' | 'tail'): Command {
  return async (ctx) => {
    const o = opts(ctx, cmd, '', 'n');
    if (!o) return 2;
    const n = parseCount(ctx, cmd, o.values.n, 10);
    if (n === null) return 1;
    const pick = (text: string): string => {
      const lines = splitLines(text);
      const sel = cmd === 'head' ? lines.slice(0, n) : n === 0 ? [] : lines.slice(-n);
      return sel.length ? sel.join('\n') + '\n' : '';
    };
    if (!o.rest.length) {
      if (ctx.stdin !== null) ctx.out(pick(ctx.stdin));
      return 0;
    }
    const { items, failed } = await readAll(ctx, cmd, o.rest);
    items.forEach((it, i) => {
      if (o.rest.length > 1) ctx.out(`${i ? '\n' : ''}==> ${it.label} <==\n`);
      ctx.out(pick(it.text));
    });
    return failed ? 1 : 0;
  };
}

const wc: Command = async (ctx) => {
  const o = opts(ctx, 'wc', 'lwc');
  if (!o) return 2;
  const any = o.flags.size > 0;
  const showL = !any || o.flags.has('l');
  const showW = !any || o.flags.has('w');
  const showC = !any || o.flags.has('c');
    const count = (text: string, name = '') => ({
    l: (text.match(/\n/g) ?? []).length,
    w: text.split(/\s+/).filter(Boolean).length,
        c: name ? byteSize(name, text) : text.length,
  });
  const row = (c: { l: number; w: number; c: number }, label: string): string =>
    [showL ? c.l : null, showW ? c.w : null, showC ? c.c : null]
      .filter((v) => v !== null)
      .join(' ') + (label ? ' ' + label : '');

  if (!o.rest.length) {
    if (ctx.stdin !== null) ctx.out(row(count(ctx.stdin), '') + '\n');
    return 0;
  }
  const { items, failed } = await readAll(ctx, 'wc', o.rest);
  const total = { l: 0, w: 0, c: 0 };
  for (const it of items) {
        const c = count(it.text, it.label);
    total.l += c.l;
    total.w += c.w;
    total.c += c.c;
    ctx.out(row(c, it.label) + '\n');
  }
  if (items.length > 1) ctx.out(row(total, 'total') + '\n');
  return failed ? 1 : 0;
};

const tree: Command = async (ctx) => {
  const o = opts(ctx, 'tree', 'a', 'L');
  if (!o) return 2;
  let maxDepth = Infinity;
  if (o.values.L !== undefined) {
    const v = parseCount(ctx, 'tree', o.values.L, 0);
    if (v === null || v < 1) {
      if (v === 0) ctx.err(ctx.t('term_invalid_number', { cmd: 'tree', value: o.values.L }) + '\n');
      return 1;
    }
    maxDepth = v;
  }
  const arg = o.rest[0] ?? '.';
  const abs = ctx.resolve(arg);
  const st = ctx.fs.stat(abs);
  if (!st) {
    ctx.err(`tree: ${ctx.t('term_err_not_found', { path: arg })}\n`);
    return 1;
  }
  if (st.type !== 'folder') {
    ctx.err(`tree: ${ctx.t('term_err_not_a_dir', { path: arg })}\n`);
    return 1;
  }
  let dirs = 0;
  let files = 0;
  ctx.out(arg + '\n');
  const walk = (dirAbs: string, prefix: string, depth: number): void => {
    const entries = ctx.fs.list(dirAbs);
    entries.forEach((e, i) => {
      const isLast = i === entries.length - 1;
      ctx.out(`${prefix}${isLast ? '└── ' : '├── '}${e.name}${e.type === 'folder' ? '/' : ''}\n`);
      if (e.type === 'folder') {
        dirs++;
        if (depth < maxDepth) walk(joinPath(dirAbs, e.name), prefix + (isLast ? '    ' : '│   '), depth + 1);
      } else {
        files++;
      }
    });
  };
  walk(abs, '', 1);
  ctx.out('\n' + ctx.t('term_tree_summary', { dirs, files }) + '\n');
  return 0;
};

const clear: Command = async (ctx) => {
  ctx.shell.requestClear();
  return 0;
};

const history: Command = async (ctx) => {
  if (ctx.args[0] === '-c') {
    ctx.shell.clearHistory();
    return 0;
  }
  ctx.shell.history.forEach((h, i) => ctx.out(`${String(i + 1).padStart(4)}  ${h}\n`));
  return 0;
};

const help: Command = async (ctx) => {
  ctx.out(ctx.t('term_help_header') + '\n');
  for (const name of ctx.shell.commandNames()) {
    ctx.out(`  ${name.padEnd(8)} ${ctx.t('term_help_' + name)}\n`);
  }
  return 0;
};

export const COMMANDS: Record<string, Command> = {
  pwd,
  cd,
  ls,
  cat,
  echo,
  mkdir,
  touch,
  rm,
  cp: transfer('cp'),
  mv: transfer('mv'),
  head: headTail('head'),
  tail: headTail('tail'),
  wc,
  tree,
  clear,
  history,
  help,
};