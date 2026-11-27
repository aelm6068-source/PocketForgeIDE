// أوامر المكتبات: pf و npm (add/remove/list/search). بتعدّل package.json بس؛ التثبيت الفعلي بيحصل وقت تشغيل المعاينة.
import type { CmdCtx, Command } from '../types';
import { addLibrary, listLibraries, removeLibrary } from '../../libs/projectPkg';
import { LibError, searchPackages, type FetchFn } from '../../libs/registry';
import { getFetch } from '../net';

const ADD = ['add', 'install', 'i'];
const REMOVE = ['remove', 'rm', 'uninstall', 'un'];
const LIST = ['list', 'ls'];
const SEARCH = ['search', 's', 'find'];

function libFailure(ctx: CmdCtx, e: unknown): number {
  if (!(e instanceof LibError)) throw e;
  const key = e.code === 'network' ? 'libs_err_network' : `libs_err_${e.code}`;
  ctx.err(ctx.t(key, { detail: e.message }) + '\n');
  return 1;
}

function usage(ctx: CmdCtx): number {
  ctx.err(ctx.t('libs_usage') + '\n');
  return 1;
}

async function run(ctx: CmdCtx, bin: string): Promise<number> {
  const [sub, ...rest] = ctx.args;
  const f = getFetch() as unknown as FetchFn | null;
  const flags = rest.filter((a) => a.startsWith('-'));
  const items = rest.filter((a) => !a.startsWith('-'));
  const dev = flags.includes('-D') || flags.includes('--save-dev') || flags.includes('--dev');
  try {
    if (!sub) return usage(ctx);
    if (ADD.includes(sub)) {
      if (!items.length) {
        // npm install بدون أسماء: مفيش تثبيت في الطرفية
        ctx.out(ctx.t('libs_install_later') + '\n');
        return 0;
      }
      if (!f) {
        ctx.err(ctx.t('libs_err_network', { detail: 'fetch' }) + '\n');
        return 1;
      }
      let code = 0;
      for (const spec of items) {
        try {
          const r = await addLibrary(ctx.fs, f, spec, dev);
          ctx.out(ctx.t('libs_added', { name: r.name, range: r.range }) + '\n');
          if (r.risk === 'native') ctx.out(ctx.t('libs_warn_native') + '\n');
          else if (/^expo-/.test(r.name) && !r.sdkTagged) ctx.out(ctx.t('libs_warn_sdk') + '\n');
        } catch (e) {
          code = libFailure(ctx, e);
        }
      }
      if (code === 0) ctx.out(ctx.t('libs_install_later') + '\n');
      return code;
    }
    if (REMOVE.includes(sub)) {
      if (!items.length) return usage(ctx);
      let code = 0;
      for (const name of items) {
        const ok = await removeLibrary(ctx.fs, name);
        if (ok) ctx.out(ctx.t('libs_removed', { name }) + '\n');
        else {
          ctx.err(ctx.t('libs_not_installed', { name }) + '\n');
          code = 1;
        }
      }
      return code;
    }
    if (LIST.includes(sub)) {
      const deps = await listLibraries(ctx.fs);
      if (!deps.length) ctx.out(ctx.t('libs_none') + '\n');
      for (const d of deps) ctx.out(`${d.name}@${d.range}${d.dev ? '  (dev)' : ''}\n`);
      return 0;
    }
    if (SEARCH.includes(sub)) {
      if (!items.length) return usage(ctx);
      if (!f) {
        ctx.err(ctx.t('libs_err_network', { detail: 'fetch' }) + '\n');
        return 1;
      }
      const hits = await searchPackages(f, items.join(' '), 10);
      if (!hits.length) ctx.out(ctx.t('libs_no_results') + '\n');
      for (const h of hits) ctx.out(`${h.name}@${h.version}${h.description ? ' - ' + h.description.slice(0, 80) : ''}\n`);
      return 0;
    }
    ctx.err(ctx.t('libs_usage') + '\n');
    return 1;
  } catch (e) {
    return libFailure(ctx, e);
  }
}

export const LIB_COMMANDS: Record<string, Command> = {
  pf: (ctx) => run(ctx, 'pf'),
  npm: (ctx) => run(ctx, 'npm'),
};
