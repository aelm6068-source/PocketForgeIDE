// src/github/update.ts
// رفع التعديلات على مستودع مربوط: بنرفع blobs للملفات الجديدة/المعدّلة بس،
// ونبني tree فوق tree آخر commit (مع حذف الملفات المحذوفة)، ونعمل commit جديد.
// قبل أي حاجة بنتأكد إن الفرع على GitHub لسه على نفس commit اللي رفعنا عليه
// آخر مرة، وإلا بنوقف (diverged) عشان منكتبش فوق شغل حد.
import type { GhCtx } from './api';
import {
  GithubApiError,
  createBlob,
  createCommit,
  createTreeOnBase,
  getBranchHead,
  getCommitTreeSha,
  updateBranch,
} from './api';
import type { ChangeSet, HashedEntry } from './diff';
import { countChanges } from './diff';

export interface UpdateInput {
  owner: string;
  repo: string;
  branch: string;
  // آخر commit رفعناه (link.headSha)
  baseHead: string;
  message: string;
  changes: ChangeSet;
  // كل ملفات المشروع الحالية (عشان نحفظ خريطة sha الجديدة كاملة)
  allEntries: HashedEntry[];
}

export interface UpdateResult {
  commitSha: string;
  files: Record<string, string>;
}

export interface UpdateProgress {
  phase: 'check' | 'files' | 'commit';
  done: number;
  total: number;
}

const BLOB_CONCURRENCY = 4;
const BLOB_RETRIES = 2;

export class UpdateError extends Error {
  cause: GithubApiError;
  constructor(cause: GithubApiError) {
    super(cause.message);
    this.name = 'UpdateError';
    this.cause = cause;
  }
}

async function uploadWithRetry(ctx: GhCtx, input: UpdateInput, entry: HashedEntry): Promise<string> {
  const sleep = ctx.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await createBlob(ctx, input.owner, input.repo, entry.content, entry.encoding);
    } catch (err) {
      const retryable = err instanceof GithubApiError && err.code === 'network';
      if (!retryable || attempt >= BLOB_RETRIES) throw err;
      await sleep(800 * (attempt + 1));
    }
  }
}

export async function pushUpdate(
  ctx: GhCtx,
  input: UpdateInput,
  onProgress?: (p: UpdateProgress) => void
): Promise<UpdateResult> {
  try {
    if (countChanges(input.changes) === 0) throw new GithubApiError('validation', 0, 'no changes');

    // 1) هل الفرع لسه على نفس commit؟
    onProgress?.({ phase: 'check', done: 0, total: 1 });
    const head = await getBranchHead(ctx, input.owner, input.repo, input.branch);
    if (head !== input.baseHead) throw new GithubApiError('diverged', 409, 'remote moved');
    onProgress?.({ phase: 'check', done: 1, total: 1 });

    // 2) blobs للملفات الجديدة والمعدّلة بس
    const toUpload = [...input.changes.added, ...input.changes.modified];
    const uploaded: Record<string, string> = {};
    let next = 0;
    let done = 0;
    let failure: unknown = null;
    onProgress?.({ phase: 'files', done: 0, total: toUpload.length });
    const worker = async (): Promise<void> => {
      while (failure === null) {
        const i = next++;
        if (i >= toUpload.length) return;
        const entry = toUpload[i];
        try {
          uploaded[entry.path] = await uploadWithRetry(ctx, input, entry);
        } catch (err) {
          failure = err;
          return;
        }
        done += 1;
        onProgress?.({ phase: 'files', done, total: toUpload.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(BLOB_CONCURRENCY, toUpload.length) }, worker));
    if (failure !== null) throw failure;

    // 3) tree فوق tree الـ commit الحالي + commit + تحريك الفرع
    onProgress?.({ phase: 'commit', done: 0, total: 1 });
    const baseTree = await getCommitTreeSha(ctx, input.owner, input.repo, head);
    const treeChanges = [
      ...toUpload.map((e) => ({ path: e.path, sha: uploaded[e.path] as string | null })),
      ...input.changes.deleted.map((p) => ({ path: p, sha: null as string | null })),
    ];
    const treeSha = await createTreeOnBase(ctx, input.owner, input.repo, baseTree, treeChanges);
    const commitSha = await createCommit(ctx, input.owner, input.repo, {
      message: input.message,
      tree: treeSha,
      parents: [head],
    });
    await updateBranch(ctx, input.owner, input.repo, input.branch, commitSha);
    onProgress?.({ phase: 'commit', done: 1, total: 1 });

    const files: Record<string, string> = {};
    for (const e of input.allEntries) files[e.path] = uploaded[e.path] ?? e.sha;
    return { commitSha, files };
  } catch (err) {
    throw new UpdateError(err instanceof GithubApiError ? err : new GithubApiError('unknown', 0, String(err)));
  }
}