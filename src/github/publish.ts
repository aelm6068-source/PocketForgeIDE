// src/github/publish.ts
// رفع لقطة المشروع (SnapshotEntry[]) على GitHub في commit واحد:
// مستودع جديد (أو موجود لو الرفع الأول فشل في النص) -> blobs -> tree -> commit -> تحديث الفرع.
import type { GhCtx, RepoInfo } from './api';
import {
  GithubApiError,
  createBlob,
  createCommit,
  createRepo,
  createTree,
  getBranchHead,
  updateBranch,
} from './api';
import type { SnapshotEntry } from './snapshot';

export type PublishPhase = 'repo' | 'files' | 'commit';

export interface PublishProgress {
  phase: PublishPhase;
  done: number;
  total: number;
}

export interface ExistingRepo {
  owner: string;
  name: string;
  branch: string;
}

export interface PublishInput {
  // مستودع جديد: اسمه ووصفه وخصوصيته. أو existing لو المستودع اتعمل قبل كده.
  newRepo?: { name: string; description: string; isPrivate: boolean };
  existing?: ExistingRepo;
  message: string;
  entries: SnapshotEntry[];
}

export interface PublishResult {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
  htmlUrl: string;
  isPrivate: boolean;
  // path -> blob sha، بنحفظها عشان نعرف الملفات اللي اتغيرت بعد كده
  blobShas: Record<string, string>;
}

// لو حصل خطأ بعد ما المستودع اتعمل فعلًا، بنرجّع بياناته مع الخطأ عشان المحاولة
// التانية تكمل على نفس المستودع بدل ما تعمل واحد جديد
export class PublishError extends Error {
  cause: GithubApiError;
  created: ExistingRepo | null;
  constructor(cause: GithubApiError, created: ExistingRepo | null) {
    super(cause.message);
    this.name = 'PublishError';
    this.cause = cause;
    this.created = created;
  }
}

const BLOB_CONCURRENCY = 4;
const BLOB_RETRIES = 2;

async function uploadBlob(
  ctx: GhCtx,
  owner: string,
  repo: string,
  entry: SnapshotEntry
): Promise<string> {
  const sleep = ctx.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await createBlob(ctx, owner, repo, entry.content, entry.encoding);
    } catch (err) {
      const retryable = err instanceof GithubApiError && err.code === 'network';
      if (!retryable || attempt >= BLOB_RETRIES) throw err;
      await sleep(800 * (attempt + 1));
    }
  }
}

export async function publishToGithub(
  ctx: GhCtx,
  input: PublishInput,
  onProgress?: (p: PublishProgress) => void
): Promise<PublishResult> {
  let created: ExistingRepo | null = input.existing ?? null;

  try {
    if (input.entries.length === 0) throw new GithubApiError('validation', 0, 'no files');
    // 1) المستودع
    let repo: RepoInfo | null = null;
    let target: ExistingRepo;
    if (input.existing) {
      target = input.existing;
    } else if (input.newRepo) {
      onProgress?.({ phase: 'repo', done: 0, total: 1 });
      repo = await createRepo(ctx, input.newRepo);
      target = { owner: repo.owner, name: repo.name, branch: repo.defaultBranch };
      created = target;
      onProgress?.({ phase: 'repo', done: 1, total: 1 });
    } else {
      throw new GithubApiError('validation', 0, 'no target repo');
    }
    const { owner, name, branch } = target;

    // 2) الـ commit الأب (أول commit عمله GitHub بعد auto_init)
    const parent = await getBranchHead(ctx, owner, name, branch);

    // 3) الملفات: blobs بتوازي محدود
    const total = input.entries.length;
    const blobShas: Record<string, string> = {};
    let next = 0;
    let done = 0;
    let failure: unknown = null;
    onProgress?.({ phase: 'files', done: 0, total });
    const worker = async (): Promise<void> => {
      while (failure === null) {
        const i = next++;
        if (i >= total) return;
        const entry = input.entries[i];
        try {
          blobShas[entry.path] = await uploadBlob(ctx, owner, name, entry);
        } catch (err) {
          failure = err;
          return;
        }
        done += 1;
        onProgress?.({ phase: 'files', done, total });
      }
    };
    await Promise.all(Array.from({ length: Math.min(BLOB_CONCURRENCY, total) }, worker));
    if (failure !== null) throw failure;

    // 4) tree ثم commit ثم تحريك الفرع
    onProgress?.({ phase: 'commit', done: 0, total: 1 });
    const treeSha = await createTree(
      ctx,
      owner,
      name,
      input.entries.map((e) => ({ path: e.path, sha: blobShas[e.path] }))
    );
    const commitSha = await createCommit(ctx, owner, name, {
      message: input.message,
      tree: treeSha,
      parents: [parent],
    });
    await updateBranch(ctx, owner, name, branch, commitSha);
    onProgress?.({ phase: 'commit', done: 1, total: 1 });

    const info = repo ?? null;
    return {
      owner,
      repo: name,
      branch,
      commitSha,
      htmlUrl: info?.htmlUrl ?? `https://github.com/${owner}/${name}`,
      isPrivate: info?.isPrivate ?? input.newRepo?.isPrivate ?? false,
      blobShas,
    };
  } catch (err) {
    const cause = err instanceof GithubApiError ? err : new GithubApiError('unknown', 0, String(err));
    // لو الخطأ هو "الاسم محجوز" فالمستودع ما اتعملش أصلًا
    throw new PublishError(cause, cause.code === 'name_taken' ? null : created);
  }
}