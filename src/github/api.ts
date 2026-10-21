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
    res = await f(`${API}${path}`, {
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