// أوامر الشبكة: curl و wget (بتحتاج إنترنت، والباقي بيشتغل بدونه)

import type { CmdCtx, Command } from '../types';
import { baseName, joinPath, parentPath } from '../paths';
import { classify, fileNameFromUrl, NetError, normalizeUrl, readBody, request } from '../net';
import type { NetResponse } from '../net';

// ---------- أدوات مساعدة ----------
/** يعرض خطأ الشبكة برسالة مفهومة ويرجّع كود الخروج */
function netFailure(ctx: CmdCtx, cmd: string, e: unknown): number {
  if (!(e instanceof NetError)) throw e;
  if (e.kind === 'timeout') {
    ctx.err(ctx.t('term_net_timeout', { cmd }) + '\n');
    return 28;
  }
  if (e.kind === 'too_large') {
    ctx.err(ctx.t('term_net_too_large', { cmd }) + '\n');
    return 63;
  }
  ctx.err(ctx.t('term_net_failed', { cmd, detail: e.detail }) + '\n');
  return 7;
}

function httpError(ctx: CmdCtx, cmd: string, res: NetResponse): void {
  ctx.err(ctx.t('term_net_http_error', { cmd, status: res.status, text: res.statusText }).trim() + '\n');
}

/** يحفظ الرد في ملف حسب نوعه. يرجّع كود الخروج وعدد البايتات */
async function saveResponse(
  ctx: CmdCtx,
  cmd: string,
  res: NetResponse,
  targetAbs: string
): Promise<{ code: number; bytes: number }> {
  const ct = res.headers.get('content-type');
  const type = (ct ?? '').split(';')[0].trim().toLowerCase() || '?';
  const kind = classify(ct, baseName(targetAbs));
  if (kind === 'binary') {
    ctx.err(ctx.t('term_net_binary_unsupported', { cmd, type }) + '\n');
    return { code: 1, bytes: 0 };
  }
  if (kind === 'image' && (type.startsWith('text/') || type.includes('json'))) {
    ctx.err(ctx.t('term_net_not_image', { cmd, type }) + '\n');
    return { code: 1, bytes: 0 };
  }
  let body: { data: string; bytes: number };
  try {
    body = await readBody(res, kind);
  } catch (e) {
    return { code: netFailure(ctx, cmd, e), bytes: 0 };
  }
  if (kind === 'text' && body.data.includes('\u0000')) {
    ctx.err(ctx.t('term_net_binary_unsupported', { cmd, type }) + '\n');
    return { code: 1, bytes: 0 };
  }
  await ctx.fs.writeFile(targetAbs, body.data);
  return { code: 0, bytes: body.bytes };
}

/** يطبع الرد النصي على الشاشة (أو الأنبوب). الملفات الثنائية مرفوضة */
async function printResponse(ctx: CmdCtx, cmd: string, res: NetResponse): Promise<number> {
  const ct = res.headers.get('content-type');
  if (classify(ct, '') !== 'text') {
    ctx.err(ctx.t('term_net_binary_stdout', { cmd }) + '\n');
    return 23;
  }
  try {
    const body = await readBody(res, 'text');
    if (body.data.includes('\u0000')) {
      ctx.err(ctx.t('term_net_binary_stdout', { cmd }) + '\n');
      return 23;
    }
    ctx.out(body.data);
    return 0;
  } catch (e) {
    return netFailure(ctx, cmd, e);
  }
}

// ---------- curl ----------
const LONG_OPTS: Record<string, string> = {
  '--output': '-o',
  '--remote-name': '-O',
  '--header': '-H',
  '--data': '-d',
  '--request': '-X',
  '--location': '-L',
  '--silent': '-s',
  '--head': '-I',
  '--include': '-i',
  '--fail': '-f',
  '--max-time': '-m',
  '--user-agent': '-A',
};

const curl: Command = async (ctx) => {
  const flags = new Set<string>();
  const headers: Record<string, string> = {};
  let out: string | undefined;
  let method: string | undefined;
  let data: string | undefined;
  let maxTime: number | undefined;
  let urlArg: string | undefined;

  const args = ctx.args.map((a) => (Object.prototype.hasOwnProperty.call(LONG_OPTS, a) ? LONG_OPTS[a] : a));
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('-') || a === '-') {
      urlArg = urlArg ?? a;
      continue;
    }
    for (let j = 1; j < a.length; j++) {
      const ch = a[j];
      if ('sSLIifOkv'.includes(ch)) {
        flags.add(ch);
      } else if ('oXHdmA'.includes(ch)) {
        const rem = a.slice(j + 1);
        const val = rem ? rem : args[++i] ?? '';
        if (ch === 'o') out = val;
        else if (ch === 'X') method = val.toUpperCase();
        else if (ch === 'd') data = val;
        else if (ch === 'm') maxTime = Number(val);
        else if (ch === 'A') headers['User-Agent'] = val;
        else {
          const k = val.indexOf(':');
          if (k > 0) headers[val.slice(0, k).trim()] = val.slice(k + 1).trim();
        }
        break;
      } else {
        ctx.err(ctx.t('term_invalid_option', { cmd: 'curl', opt: '-' + ch }) + '\n');
        return 2;
      }
    }
  }
  if (maxTime !== undefined && !(maxTime > 0)) {
    ctx.err(ctx.t('term_invalid_number', { cmd: 'curl', value: String(maxTime) }) + '\n');
    return 2;
  }
  if (urlArg === undefined) {
    ctx.err(ctx.t('term_net_missing_url', { cmd: 'curl' }) + '\n');
    return 2;
  }
  const url = normalizeUrl(urlArg);
  if (!url) {
    ctx.err(ctx.t('term_net_bad_url', { cmd: 'curl', url: urlArg }) + '\n');
    return 3;
  }
  if (out !== undefined && flags.has('O')) flags.delete('O');

  let body: string | undefined;
  if (data !== undefined) {
    body = data.startsWith('@') ? await ctx.fs.readFile(ctx.resolve(data.slice(1))) : data;
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }
  const verb = method ?? (flags.has('I') ? 'HEAD' : body !== undefined ? 'POST' : 'GET');

  let res: NetResponse;
  try {
    res = await request(url, { method: verb, headers, body }, maxTime ? maxTime * 1000 : undefined);
  } catch (e) {
    return netFailure(ctx, 'curl', e);
  }

  if (flags.has('f') && !res.ok) {
    httpError(ctx, 'curl', res);
    return 22;
  }
  if (flags.has('I') || flags.has('i')) {
    let head = `HTTP ${res.status} ${res.statusText}`.trim() + '\n';
    res.headers.forEach((v, k) => {
      head += `${k}: ${v}\n`;
    });
    ctx.out(head + (flags.has('I') ? '' : '\n'));
    if (flags.has('I')) return 0;
  }

  const target = out ?? (flags.has('O') ? fileNameFromUrl(res.url || url) : undefined);
  if (target === undefined) return printResponse(ctx, 'curl', res);

  const abs = ctx.resolve(target);
  const r = await saveResponse(ctx, 'curl', res, abs);
  if (r.code === 0 && !flags.has('s')) ctx.out(ctx.t('term_net_saved', { bytes: r.bytes, path: target }) + '\n');
  return r.code;
};

// ---------- wget ----------
async function freeName(ctx: CmdCtx, dirAbs: string, name: string): Promise<string> {
  if (!ctx.fs.stat(joinPath(dirAbs, name))) return name;
  for (let n = 1; n < 1000; n++) {
    const cand = `${name}.${n}`;
    if (!ctx.fs.stat(joinPath(dirAbs, cand))) return cand;
  }
  return name;
}

const wget: Command = async (ctx) => {
  let outArg: string | undefined;
  let dirArg: string | undefined;
  let quiet = false;
  let urlArg: string | undefined;
  const args = ctx.args;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-q' || a === '--quiet' || a === '-nv') quiet = true;
    else if (a === '-O' || a === '--output-document') outArg = args[++i] ?? '';
    else if (a.startsWith('-O') && a.length > 2) outArg = a.slice(2);
    else if (a === '-P' || a === '--directory-prefix') dirArg = args[++i] ?? '';
    else if (a.startsWith('-') && a !== '-') {
      ctx.err(ctx.t('term_invalid_option', { cmd: 'wget', opt: a }) + '\n');
      return 2;
    } else urlArg = urlArg ?? a;
  }
  if (urlArg === undefined) {
    ctx.err(ctx.t('term_net_missing_url', { cmd: 'wget' }) + '\n');
    return 1;
  }
  const url = normalizeUrl(urlArg);
  if (!url) {
    ctx.err(ctx.t('term_net_bad_url', { cmd: 'wget', url: urlArg }) + '\n');
    return 1;
  }

  let res: NetResponse;
  try {
    res = await request(url, { method: 'GET' });
  } catch (e) {
    return netFailure(ctx, 'wget', e);
  }
  if (!res.ok) {
    httpError(ctx, 'wget', res);
    return 8;
  }
  if (outArg === '-') return printResponse(ctx, 'wget', res);

  let shown: string;
  let abs: string;
  if (outArg !== undefined && outArg !== '') {
    shown = outArg;
    abs = ctx.resolve(outArg);
  } else {
    const dirAbs = ctx.resolve(dirArg ?? '.');
    const name = await freeName(ctx, dirAbs, fileNameFromUrl(res.url || url));
    abs = joinPath(dirAbs, name);
    shown = dirArg ? joinPath(dirArg.replace(/\/+$/, '') || '/', name) : name;
  }
  if (!ctx.fs.stat(parentPath(abs))) {
    const dirShown = outArg ? outArg.slice(0, outArg.lastIndexOf('/')) || '/' : dirArg ?? '.';
    ctx.err(`wget: ${ctx.t('term_err_not_found', { path: dirShown })}\n`);
    return 1;
  }
  const r = await saveResponse(ctx, 'wget', res, abs);
  if (r.code === 0 && !quiet) ctx.out(ctx.t('term_net_saved', { bytes: r.bytes, path: shown }) + '\n');
  return r.code;
};

export const NET_COMMANDS: Record<string, Command> = { curl, wget };