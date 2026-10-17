// أمر node: تشغيل ملفات جافاسكربت على الجهاز (المُشغّل الفعلي يُحقن من الواجهة عبر ctx.js)

import { FsError } from '../types';
import type { CmdCtx, Command, JsRunInput } from '../types';
import type { VirtualFs } from '../vfs';

const TIMEOUT_MS = 15000;
const MAX_FILE_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 8_000_000;
const MAX_FILES = 3000;
const IMAGE_RE = /\.(png|jpe?g|gif|webp|ico|bmp)$/i;
const VERSION = 'v20.0.0-pocketforge';

interface Snapshot {
  files: Record<string, string>;
  skipped: string[];
  dirs: string[];
}

/** يلتقط ملفات المشروع النصية ليقرأها المُشغّل بشكل متزامن (require / fs). */
async function takeSnapshot(fs: VirtualFs): Promise<Snapshot> {
  const files: Record<string, string> = {};
  const skipped: string[] = [];
  const dirs: string[] = [];
  const later: string[] = [];
  let total = 0;
  let count = 0;

  const readInto = async (path: string): Promise<void> => {
    if (IMAGE_RE.test(path) || count >= MAX_FILES) {
      skipped.push(path);
      return;
    }
    let text: string;
    try {
      text = await fs.readFile(path);
    } catch {
      skipped.push(path);
      return;
    }
    if (text.length > MAX_FILE_BYTES || total + text.length > MAX_TOTAL_BYTES || text.indexOf('\u0000') !== -1) {
      skipped.push(path);
      return;
    }
    total += text.length;
    count++;
    files[path] = text;
  };

  const walk = async (dir: string): Promise<void> => {
    for (const e of fs.list(dir)) {
      const full = dir === '/' ? '/' + e.name : dir + '/' + e.name;
      if (e.type === 'folder') {
        dirs.push(full);
        if (e.name === 'node_modules') later.push(full);
        else await walk(full);
      } else {
        await readInto(full);
      }
    }
  };
  await walk('/');
  for (const d of later) await walk(d);
  return { files, skipped, dirs };
}

async function applyResult(ctx: CmdCtx, r: { writes: Record<string, string>; removes: string[]; mkdirs: string[] }): Promise<void> {
  const report = (e: unknown, path: string): void => {
    if (e instanceof FsError) ctx.err(`node: ${ctx.t('term_err_' + e.code, { path })}\n`);
    else throw e;
  };
  for (const p of r.removes) {
    try {
      await ctx.fs.remove(p, true);
    } catch (e) {
      report(e, p);
    }
  }
  for (const p of r.mkdirs) {
    try {
      await ctx.fs.mkdir(p, true);
    } catch (e) {
      report(e, p);
    }
  }
  for (const p of Object.keys(r.writes)) {
    try {
      await ctx.fs.writeFile(p, r.writes[p]);
    } catch (e) {
      report(e, p);
    }
  }
}

const node: Command = async (ctx) => {
  const { t } = ctx;
  const args = ctx.args.slice();
  let evalCode: string | null = null;
  let script: string | null = null;

  while (args.length) {
    const a = args[0];
    if (a === '-v' || a === '--version') {
      ctx.out(VERSION + '\n');
      return 0;
    }
    if (a === '-e' || a === '--eval' || a === '-p' || a === '--print') {
      args.shift();
      if (!args.length) {
        ctx.err(t('term_node_missing_code') + '\n');
        return 9;
      }
      evalCode = args.shift() as string;
      if (a === '-p' || a === '--print') evalCode = 'console.log(' + evalCode + ')';
      break;
    }
    if (a === '--') {
      args.shift();
      break;
    }
    if (a.startsWith('-') && a !== '-') {
      ctx.err(t('term_node_bad_option', { opt: a }) + '\n');
      return 9;
    }
    break;
  }

  if (evalCode === null) {
    if (!args.length) {
      ctx.err(t('term_node_usage') + '\n');
      return 9;
    }
    script = args.shift() as string;
  }

  if (!ctx.js) {
    ctx.err(t('term_node_unavailable') + '\n');
    return 1;
  }

  let input: JsRunInput;
  const snap = await takeSnapshot(ctx.fs);
  if (evalCode !== null) {
    input = {
      code: evalCode,
      filename: '[eval]',
      isEval: true,
      cwd: ctx.resolve('.'),
      args: args,
      files: snap.files,
      skipped: snap.skipped,
      dirs: snap.dirs,
      timeoutMs: TIMEOUT_MS,
    };
  } else {
    let abs = ctx.resolve(script as string);
    let st = ctx.fs.stat(abs);
    if (!st && ctx.fs.stat(abs + '.js')?.type === 'file') {
      abs += '.js';
      st = ctx.fs.stat(abs);
    }
    if (!st) {
      ctx.err(t('term_node_not_found', { path: script as string }) + '\n');
      return 1;
    }
    if (st.type === 'folder') {
      const idx = abs === '/' ? '/index.js' : abs + '/index.js';
      if (ctx.fs.stat(idx)?.type === 'file') abs = idx;
      else {
        ctx.err(t('term_node_not_found', { path: script as string }) + '\n');
        return 1;
      }
    }
    input = {
      code: '',
      filename: abs,
      isEval: false,
      cwd: ctx.resolve('.'),
      args: args,
      files: snap.files,
      skipped: snap.skipped,
      dirs: snap.dirs,
      timeoutMs: TIMEOUT_MS,
    };
    if (!(abs in snap.files)) {
      ctx.err(t('term_node_unreadable', { path: script as string }) + '\n');
      return 1;
    }
  }

  const notes: string[] = [];
  const res = await ctx.js.run(input, {
    out: (s) => ctx.out(s),
    err: (s) => ctx.err(s),
    diag: (code, arg) => {
      if (code === 'esm') notes.push(t('term_node_esm'));
      else if (code === 'npm') notes.push(t('term_node_npm', { name: arg ?? '' }));
      else if (code === 'truncated') notes.push(t('term_node_truncated'));
    },
  });

  if (res.status === 'ok') await applyResult(ctx, res);
  for (const n of notes) ctx.err(n + '\n');

  if (res.status === 'timeout') {
    ctx.err(t('term_node_timeout', { sec: Math.round(TIMEOUT_MS / 1000) }) + '\n');
    return 124;
  }
  if (res.status === 'stopped') {
    ctx.err(t('term_node_stopped') + '\n');
    return 130;
  }
  if (res.status === 'crashed') {
    ctx.err(t('term_node_crashed') + '\n');
    return 1;
  }
  return res.code;
};

export const NODE_COMMANDS: Record<string, Command> = { node };