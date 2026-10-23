// src/github/pull.ts
// سحب التغييرات من GitHub: بنقرا حالة المستودع (آخر commit وكل ملفاته)، وبعد ما
// المستخدم يراجع الخطة بننزّل الملفات المطلوبة بس، وبعدين نطبّقها على المشروع.
// التنزيل كله بيخلص قبل أي كتابة، فلو النت قطع في النص مفيش حاجة بتتغير عندك.
import type { GhCtx } from './api';
import { GithubApiError, getBlobBase64, getBranchHead, getCommitTreeSha, getTreeFiles } from './api';
import { applyRemote } from './applyRemote';
import type { ApplyStore } from './applyRemote';
import { decodeBlob } from './codec';
import type { Choice, PullPlan, PullSkip } from './pullPlan';
import { nextBase, resolveConflicts } from './pullPlan';
import type { RemoteFile } from './pullPlan';
import type { FsNode } from '../terminal/types';

export interface RemoteState {
  head: string;
  files: RemoteFile[];
}

export async function fetchRemoteState(
  ctx: GhCtx,
  link: { owner: string; repo: string; branch: string }
): Promise<RemoteState> {
  const head = await getBranchHead(ctx, link.owner, link.repo, link.branch);
  const treeSha = await getCommitTreeSha(ctx, link.owner, link.repo, head);
  const files = await getTreeFiles(ctx, link.owner, link.repo, treeSha);
  return { head, files };
}

export interface PullInput {
  owner: string;
  repo: string;
  nodes: FsNode[];
  plan: PullPlan;
  choices: Record<string, Choice>;
  // base الحالية (link.files)
  baseFiles: Record<string, string>;
  // آخر commit اتحسبت عليه الخطة
  remoteHead: string;
}

export interface PullResult {
  nodes: FsNode[];
  files: Record<string, string>;
  headSha: string;
  writtenCount: number;
  deletedCount: number;
  skipped: PullSkip[];
}

export interface PullProgress {
  phase: 'files' | 'apply';
  done: number;
  total: number;
}

export class PullError extends Error {
  cause: GithubApiError;
  constructor(cause: GithubApiError) {
    super(cause.message);
    this.name = 'PullError';
    this.cause = cause;
  }
}

const BLOB_CONCURRENCY = 4;
const BLOB_RETRIES = 2;

async function downloadWithRetry(ctx: GhCtx, input: PullInput, sha: string): Promise<string> {
  const sleep = ctx.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await getBlobBase64(ctx, input.owner, input.repo, sha);
    } catch (err) {
      const retryable = err instanceof GithubApiError && err.code === 'network';
      if (!retryable || attempt >= BLOB_RETRIES) throw err;
      await sleep(800 * (attempt + 1));
    }
  }
}

export async function executePull(
  ctx: GhCtx,
  input: PullInput,
  store: ApplyStore,
  onProgress?: (p: PullProgress) => void
): Promise<PullResult> {
  try {
    const { writes, deletes } = resolveConflicts(input.plan, input.choices);

    // 1) تنزيل كل الملفات المطلوبة (من غير ما نكتب حاجة لسه)
    const downloaded: { path: string; content: string }[] = [];
    const failed: PullSkip[] = [];
    let next = 0;
    let done = 0;
    let failure: unknown = null;
    onProgress?.({ phase: 'files', done: 0, total: writes.length });
    const worker = async (): Promise<void> => {
      while (failure === null) {
        const i = next++;
        if (i >= writes.length) return;
        const w = writes[i];
        try {
          const b64 = await downloadWithRetry(ctx, input, w.sha);
          const dec = decodeBlob(w.path, b64);
          if (dec.ok) downloaded.push({ path: w.path, content: dec.content });
          else failed.push({ path: w.path, reason: dec.reason });
        } catch (err) {
          failure = err;
          return;
        }
        done += 1;
        onProgress?.({ phase: 'files', done, total: writes.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(BLOB_CONCURRENCY, writes.length) }, worker));
    if (failure !== null) throw failure;

    downloaded.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    // 2) تطبيق على المشروع
    onProgress?.({ phase: 'apply', done: 0, total: 1 });
    const applied = await applyRemote(input.nodes, downloaded, deletes, store);
    onProgress?.({ phase: 'apply', done: 1, total: 1 });

    const allFailed = [...failed, ...applied.failed];
    return {
      nodes: applied.nodes,
      files: nextBase(input.plan, input.baseFiles, allFailed),
      headSha: input.remoteHead,
      writtenCount: applied.writtenCount,
      deletedCount: applied.deletedCount,
      skipped: [...input.plan.skipped, ...allFailed],
    };
  } catch (err) {
    throw new PullError(err instanceof GithubApiError ? err : new GithubApiError('unknown', 0, String(err)));
  }
}