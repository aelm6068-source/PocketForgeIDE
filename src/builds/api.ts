// src/builds/api.ts
// طلبات GitHub Actions/Contents/Releases اللازمة لتاب البناء. بتستخدم نفس GhCtx بتاع تكامل GitHub.
// الأخطاء بترجع GithubApiError بنفس الأكواد، والمحوّلات (parse*) دوال نقية.
import { GithubApiError, type GhCtx } from '../github/api';
import { RELEASE_PREFIX, WORKFLOW_FILE, WORKFLOW_PATH } from './workflow';

const API = 'https://api.github.com';

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

async function call(
  ctx: GhCtx,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  const f = ctx.fetchFn ?? fetch;
  let res: Response;
  try {
    const stamp = method === 'GET' ? `${path.includes('?') ? '&' : '?'}_=${Date.now()}` : '';
    res = await f(`${API}${path}${stamp}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${ctx.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GithubApiError('network');
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null; // 204 بدون جسم
  }
  if (!res.ok) {
    const msg = String(json?.message ?? '');
    const s = res.status;
    if (s === 401) throw new GithubApiError('unauthorized', s, msg);
    if (s === 403 || s === 429) {
      const limited = res.headers?.get?.('x-ratelimit-remaining') === '0' || /rate limit/i.test(msg) || s === 429;
      throw new GithubApiError(limited ? 'rate_limit' : 'forbidden', s, msg);
    }
    if (s === 404) throw new GithubApiError('not_found', s, msg);
    if (s === 422) throw new GithubApiError('validation', s, msg);
    throw new GithubApiError('unknown', s, msg || `HTTP ${s}`);
  }
  return { status: res.status, json };
}

const enc = encodeURIComponent;
const base = (r: RepoRef) => `/repos/${r.owner}/${r.repo}`;

// ---------- ملف البناء ----------
export async function getWorkflowSha(ctx: GhCtx, r: RepoRef): Promise<string | null> {
  try {
    const { json } = await call(ctx, 'GET', `${base(r)}/contents/${WORKFLOW_PATH}?ref=${enc(r.branch)}`);
    return typeof json?.sha === 'string' ? json.sha : null;
  } catch (e) {
    if (e instanceof GithubApiError && e.code === 'not_found') return null;
    throw e;
  }
}

// بيكتب ملف البناء في commit واحد على الفرع. بيرجّع sha الـ commit الجديد.
export async function putWorkflow(ctx: GhCtx, r: RepoRef, yaml: string, existingSha: string | null): Promise<string> {
  const content = b64(yaml);
  const { json } = await call(ctx, 'PUT', `${base(r)}/contents/${WORKFLOW_PATH}`, {
    message: 'Add APK build workflow (PocketForge)',
    content,
    branch: r.branch,
    ...(existingSha ? { sha: existingSha } : {}),
  });
  const sha = json?.commit?.sha;
  if (typeof sha !== 'string') throw new GithubApiError('unknown', 0, 'bad contents response');
  return sha;
}

function b64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// ---------- التشغيل ----------
export async function dispatchBuild(ctx: GhCtx, r: RepoRef): Promise<void> {
  await call(ctx, 'POST', `${base(r)}/actions/workflows/${WORKFLOW_FILE}/dispatches`, { ref: r.branch });
}

export type RunState = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
export interface RunInfo {
  id: number;
  number: number;
  state: RunState;
  createdAt: string;
  htmlUrl: string;
}

export function runState(status: unknown, conclusion: unknown): RunState {
  if (status === 'completed') {
    if (conclusion === 'success') return 'success';
    if (conclusion === 'cancelled') return 'cancelled';
    return 'failed';
  }
  return status === 'in_progress' ? 'running' : 'queued';
}

export function parseRuns(json: any): RunInfo[] {
  const list: any[] = Array.isArray(json?.workflow_runs) ? json.workflow_runs : [];
  const out: RunInfo[] = [];
  for (const w of list) {
    if (typeof w?.id !== 'number' || typeof w?.run_number !== 'number') continue;
    out.push({
      id: w.id,
      number: w.run_number,
      state: runState(w.status, w.conclusion),
      createdAt: String(w.created_at ?? ''),
      htmlUrl: String(w.html_url ?? ''),
    });
  }
  return out;
}

export async function listRuns(ctx: GhCtx, r: RepoRef, limit = 8): Promise<RunInfo[]> {
  const { json } = await call(ctx, 'GET', `${base(r)}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=${limit}&branch=${enc(r.branch)}`);
  return parseRuns(json);
}

// الخطوة اللي فشلت (أول خطوة conclusion=failure)
export function failedStep(json: any): string | null {
  const jobs: any[] = Array.isArray(json?.jobs) ? json.jobs : [];
  for (const j of jobs) {
    const steps: any[] = Array.isArray(j?.steps) ? j.steps : [];
    const bad = steps.find((s) => s?.conclusion === 'failure');
    if (bad && typeof bad.name === 'string') return bad.name;
    if (j?.conclusion === 'failure' && typeof j.name === 'string') return j.name;
  }
  return null;
}

export async function getFailedStep(ctx: GhCtx, r: RepoRef, runId: number): Promise<string | null> {
  const { json } = await call(ctx, 'GET', `${base(r)}/actions/runs/${runId}/jobs`);
  return failedStep(json);
}

// ---------- الـ APK الناتج ----------
export interface ApkInfo {
  releaseUrl: string;
  downloadUrl: string | null;
  size: number | null;
}

export function parseRelease(json: any): ApkInfo | null {
  if (!json || typeof json.html_url !== 'string') return null;
  const assets: any[] = Array.isArray(json.assets) ? json.assets : [];
  const apk = assets.find((a) => typeof a?.name === 'string' && a.name.endsWith('.apk'));
  return {
    releaseUrl: json.html_url,
    downloadUrl: typeof apk?.browser_download_url === 'string' ? apk.browser_download_url : null,
    size: typeof apk?.size === 'number' ? apk.size : null,
  };
}

// بنجرّب وسم الإصدار الافتراضي (build-N) وبعدين test-N (المستخدم في workflow بتاع PocketForge نفسه)
const RELEASE_PREFIXES = [RELEASE_PREFIX, 'test-'];

export async function getApk(ctx: GhCtx, r: RepoRef, runNumber: number): Promise<ApkInfo | null> {
  for (const prefix of RELEASE_PREFIXES) {
    try {
      const { json } = await call(ctx, 'GET', `${base(r)}/releases/tags/${prefix}${runNumber}`);
      const apk = parseRelease(json);
      if (apk) return apk;
    } catch (e) {
      if (!(e instanceof GithubApiError && e.code === 'not_found')) throw e;
    }
  }
  return null;
}
