// src/github/api.ts
// طلبات GitHub REST اللازمة للرفع: إنشاء مستودع، blobs، tree، commit، تحديث الفرع.
// منطق صرف (fetch بس). كل الأخطاء بترجع GithubApiError بكود ثابت والواجهة بتترجمه.
const API = 'https://api.github.com';

export type ApiErrorCode =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'name_taken'
  | 'validation'
  | 'rate_limit'
  | 'empty_repo'
  | 'diverged'
  | 'too_large'
  | 'unknown';

export class GithubApiError extends Error {
  code: ApiErrorCode;
  status: number;
  constructor(code: ApiErrorCode, status = 0, message?: string) {
    super(message ?? code);
    this.name = 'GithubApiError';
    this.code = code;
    this.status = status;
  }
}

export interface GhCtx {
  token: string;
  fetchFn?: typeof fetch;
  // لاستبدال الانتظار في الاختبارات
  sleep?: (ms: number) => Promise<void>;
}

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface ErrorBody {
  message?: string;
  errors?: { message?: string; code?: string; field?: string }[];
}

function mapError(status: number, body: ErrorBody, remaining: string | null): GithubApiError {
  const message = body.message ?? '';
  if (status === 401) return new GithubApiError('unauthorized', status, message);
  if (status === 403 || status === 429) {
    const limited = remaining === '0' || /rate limit/i.test(message) || status === 429;
    return new GithubApiError(limited ? 'rate_limit' : 'forbidden', status, message);
  }
  if (status === 404) return new GithubApiError('not_found', status, message);
  if (status === 409 && /empty/i.test(message)) return new GithubApiError('empty_repo', status, message);
    if (status === 422 && /fast.forward/i.test(message)) return new GithubApiError('diverged', status, message);
  if (status === 422) {
    const taken = (body.errors ?? []).some((e) => /already exists/i.test(e.message ?? ''));
    return new GithubApiError(taken ? 'name_taken' : 'validation', status, message);
  }
  return new GithubApiError('unknown', status, message || `HTTP ${status}`);
}

async function request<T>(
  ctx: GhCtx,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown
): Promise<T> {
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
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw mapError(res.status, (json ?? {}) as ErrorBody, res.headers?.get?.('x-ratelimit-remaining') ?? null);
  }
  return json as T;
}

export interface RepoInfo {
  owner: string;
  name: string;
  defaultBranch: string;
  htmlUrl: string;
  isPrivate: boolean;
}

interface RawRepo {
  name?: string;
  owner?: { login?: string };
  default_branch?: string;
  html_url?: string;
  private?: boolean;
}

function toRepoInfo(raw: RawRepo): RepoInfo {
  if (!raw.name || !raw.owner?.login) throw new GithubApiError('unknown', 0, 'bad repo response');
  return {
    owner: raw.owner.login,
    name: raw.name,
    defaultBranch: raw.default_branch ?? 'main',
    htmlUrl: raw.html_url ?? `https://github.com/${raw.owner.login}/${raw.name}`,
    isPrivate: raw.private === true,
  };
}

// auto_init: true ضروري: Git Data API بترفض أي طلب على مستودع فاضي تمامًا (409)،
// فبنخلي GitHub يعمل أول commit (README) وبعدين commit بتاعنا ييجي فوقه.
export async function createRepo(
  ctx: GhCtx,
  opts: { name: string; description: string; isPrivate: boolean }
): Promise<RepoInfo> {
  const raw = await request<RawRepo>(ctx, 'POST', '/user/repos', {
    name: opts.name,
    description: opts.description,
    private: opts.isPrivate,
    auto_init: true,
  });
  return toRepoInfo(raw);
}

export async function getRepo(ctx: GhCtx, owner: string, repo: string): Promise<RepoInfo> {
  return toRepoInfo(await request<RawRepo>(ctx, 'GET', `/repos/${owner}/${repo}`));
}

// آخر commit في فرع. بعد auto_init الفرع ممكن يتأخر ثواني يظهر، فبنحاول كذا مرة.
export async function getBranchHead(
  ctx: GhCtx,
  owner: string,
  repo: string,
  branch: string,
  attempts = 5
): Promise<string> {
  const sleep = ctx.sleep ?? defaultSleep;
  let last: GithubApiError | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const ref = await request<{ object?: { sha?: string } }>(
        ctx,
        'GET',
        `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
      );
      const sha = ref.object?.sha;
      if (!sha) throw new GithubApiError('unknown', 0, 'bad ref response');
      return sha;
    } catch (err) {
      if (!(err instanceof GithubApiError)) throw err;
      last = err;
      const retryable = err.code === 'not_found' || err.code === 'empty_repo';
      if (!retryable || i === attempts - 1) throw err;
      await sleep(1000);
    }
  }
  throw last ?? new GithubApiError('unknown');
}

export async function createBlob(
  ctx: GhCtx,
  owner: string,
  repo: string,
  content: string,
  encoding: 'utf-8' | 'base64'
): Promise<string> {
  const res = await request<{ sha?: string }>(ctx, 'POST', `/repos/${owner}/${repo}/git/blobs`, {
    content,
    encoding,
  });
  if (!res.sha) throw new GithubApiError('unknown', 0, 'bad blob response');
  return res.sha;
}

export async function createTree(
  ctx: GhCtx,
  owner: string,
  repo: string,
  items: { path: string; sha: string }[]
): Promise<string> {
  const res = await request<{ sha?: string }>(ctx, 'POST', `/repos/${owner}/${repo}/git/trees`, {
    tree: items.map((i) => ({ path: i.path, mode: '100644', type: 'blob', sha: i.sha })),
  });
  if (!res.sha) throw new GithubApiError('unknown', 0, 'bad tree response');
  return res.sha;
}

export async function createCommit(
  ctx: GhCtx,
  owner: string,
  repo: string,
  opts: { message: string; tree: string; parents: string[] }
): Promise<string> {
  const res = await request<{ sha?: string }>(ctx, 'POST', `/repos/${owner}/${repo}/git/commits`, opts);
  if (!res.sha) throw new GithubApiError('unknown', 0, 'bad commit response');
  return res.sha;
}

export async function updateBranch(
  ctx: GhCtx,
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> {
  await request(ctx, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    sha,
    force: false,
  });
}
// tree الـ commit (بنبني فوقه tree جديد من غير ما نعيد رفع الملفات الباقية)
export async function getCommitTreeSha(
  ctx: GhCtx,
  owner: string,
  repo: string,
  commitSha: string
): Promise<string> {
  const res = await request<{ tree?: { sha?: string } }>(
    ctx,
    'GET',
    `/repos/${owner}/${repo}/git/commits/${commitSha}`
  );
  const sha = res.tree?.sha;
  if (!sha) throw new GithubApiError('unknown', 0, 'bad commit response');
  return sha;
}

// sha = null يعني "احذف الملف ده"
export interface TreeChange {
  path: string;
  sha: string | null;
}

export async function createTreeOnBase(
  ctx: GhCtx,
  owner: string,
  repo: string,
  baseTree: string,
  changes: TreeChange[]
): Promise<string> {
  const res = await request<{ sha?: string }>(ctx, 'POST', `/repos/${owner}/${repo}/git/trees`, {
    base_tree: baseTree,
    tree: changes.map((c) => ({ path: c.path, mode: '100644', type: 'blob', sha: c.sha })),
  });
  if (!res.sha) throw new GithubApiError('unknown', 0, 'bad tree response');
  return res.sha;
}
export interface RemoteTreeEntry {
  path: string;
  sha: string;
  size: number;
}

// كل ملفات tree معين (بما فيها المجلدات الفرعية) في طلب واحد.
// لو المستودع كبير جدًا GitHub بيقصّ النتيجة (truncated)، وساعتها منسحبش حاجة ناقصة.
export async function getTreeFiles(
  ctx: GhCtx,
  owner: string,
  repo: string,
  treeSha: string
): Promise<RemoteTreeEntry[]> {
  const res = await request<{
    tree?: { path?: string; type?: string; sha?: string; size?: number }[];
    truncated?: boolean;
  }>(ctx, 'GET', `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
  if (!res.tree) throw new GithubApiError('unknown', 0, 'bad tree response');
  if (res.truncated) throw new GithubApiError('too_large', 0, 'tree truncated');
  const out: RemoteTreeEntry[] = [];
  for (const e of res.tree) {
    if (e.type === 'blob' && e.path && e.sha) out.push({ path: e.path, sha: e.sha, size: e.size ?? 0 });
  }
  return out;
}

// محتوى ملف (base64 زي ما GitHub بيرجّعه)
export async function getBlobBase64(ctx: GhCtx, owner: string, repo: string, sha: string): Promise<string> {
  const res = await request<{ content?: string; encoding?: string }>(
    ctx,
    'GET',
    `/repos/${owner}/${repo}/git/blobs/${sha}`
  );
  if (typeof res.content !== 'string' || res.encoding !== 'base64') {
    throw new GithubApiError('unknown', 0, 'bad blob response');
  }
  return res.content;
}
export interface RepoListItem {
  owner: string;
  name: string;
  defaultBranch: string;
  htmlUrl: string;
  isPrivate: boolean;
  description: string;
  pushedAt: string;
  archived: boolean;
}

interface RawListRepo extends RawRepo {
  description?: string | null;
  pushed_at?: string | null;
  archived?: boolean;
}

// مستودعات الحساب (بتاعتك + اللي ليك فيها صلاحية)، الأحدث نشاطًا الأول.
// بنقرا لحد maxPages صفحة (100 مستودع في الصفحة).
export async function listUserRepos(ctx: GhCtx, maxPages = 5): Promise<RepoListItem[]> {
  const out: RepoListItem[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const raw = await request<RawListRepo[]>(
      ctx,
      'GET',
      `/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`
    );
    if (!Array.isArray(raw)) throw new GithubApiError('unknown', 0, 'bad repos response');
    for (const r of raw) {
      if (!r.name || !r.owner?.login) continue;
      out.push({
        owner: r.owner.login,
        name: r.name,
        defaultBranch: r.default_branch ?? 'main',
        htmlUrl: r.html_url ?? `https://github.com/${r.owner.login}/${r.name}`,
        isPrivate: r.private === true,
        description: r.description ?? '',
        pushedAt: r.pushed_at ?? '',
        archived: r.archived === true,
      });
    }
    if (raw.length < 100) break;
  }
  return out;
}