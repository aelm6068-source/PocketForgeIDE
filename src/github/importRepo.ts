// src/github/importRepo.ts
// استيراد مستودع GitHub كمشروع جديد: بنقرا آخر commit وكل ملفاته، وبننزّل الملفات
// (نفس منطق السحب اللي اتختبر: بنعتبر المشروع فاضي فكل ملف "جديد")، وبنبني قايمة الملفات.
// بيرجّع كل اللي المستدعي محتاجه عشان يحفظ المشروع ويربطه بالمستودع.
import type { GhCtx } from './api';
import { GithubApiError, getBranchHead, getCommitTreeSha, getTreeFiles } from './api';
import type { ApplyStore } from './applyRemote';
import { executePull, PullError } from './pull';
import type { PullProgress } from './pull';
import { planPull } from './pullPlan';
import type { PullSkip } from './pullPlan';
import type { FsNode } from '../terminal/types';

export const MAX_IMPORT_FILES = 5000;
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export type ImportLanguage = 'typescript' | 'javascript';

export type ImportProgress = PullProgress | { phase: 'tree'; done: number; total: number };

export interface ImportInput {
  owner: string;
  repo: string;
  branch: string;
}

export interface ImportResult {
  nodes: FsNode[];
  // path -> blob sha (نقطة المزامنة الأولى)
  files: Record<string, string>;
  headSha: string;
  skipped: PullSkip[];
  language: ImportLanguage;
  fileCount: number;
}

export class ImportError extends Error {
  // أكواد GitHub العادية + حالات خاصة بالاستيراد
  code: GithubApiError['code'] | 'repo_empty' | 'no_files' | 'too_big';
  constructor(code: ImportError['code'], message?: string) {
    super(message ?? code);
    this.name = 'ImportError';
    this.code = code;
  }
}

// TypeScript لو فيه tsconfig.json أو أي ملف .ts/.tsx، غير كده JavaScript
export function detectLanguage(paths: string[]): ImportLanguage {
  for (const p of paths) {
    const base = p.split('/').pop() ?? '';
    if (base === 'tsconfig.json' || /\.(ts|tsx)$/.test(base)) {
      if (!/\.d\.ts$/.test(base) || base === 'tsconfig.json') return 'typescript';
    }
  }
  return 'javascript';
}

export async function importRepo(
  ctx: GhCtx,
  input: ImportInput,
  store: ApplyStore,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  try {
    onProgress?.({ phase: 'tree', done: 0, total: 1 });
    // محاولة واحدة بس: مستودع فاضي مفيهوش فرع أصلًا ومينفعش نستنى عليه
    let head: string;
    try {
      head = await getBranchHead(ctx, input.owner, input.repo, input.branch, 1);
    } catch (err) {
      if (err instanceof GithubApiError && (err.code === 'empty_repo' || err.code === 'not_found')) {
        throw new ImportError('repo_empty');
      }
      throw err;
    }
    const treeSha = await getCommitTreeSha(ctx, input.owner, input.repo, head);
    const remote = await getTreeFiles(ctx, input.owner, input.repo, treeSha);
    onProgress?.({ phase: 'tree', done: 1, total: 1 });

    const plan = planPull({}, {}, remote);
    if (plan.writes.length === 0) throw new ImportError('no_files');
    const sizeOf = new Map(remote.map((f) => [f.path, f.size]));
    const totalBytes = plan.writes.reduce((sum, w) => sum + (sizeOf.get(w.path) ?? 0), 0);
    if (plan.writes.length > MAX_IMPORT_FILES || totalBytes > MAX_IMPORT_BYTES) throw new ImportError('too_big');

    const result = await executePull(
      ctx,
      {
        owner: input.owner,
        repo: input.repo,
        nodes: [],
        plan,
        choices: {},
        baseFiles: {},
        remoteHead: head,
      },
      store,
      onProgress
    );
    if (result.writtenCount === 0) throw new ImportError('no_files');

    const filePaths = Object.keys(result.files);
    return {
      nodes: result.nodes,
      files: result.files,
      headSha: result.headSha,
      skipped: result.skipped,
      language: detectLanguage(filePaths),
      fileCount: result.writtenCount,
    };
  } catch (err) {
    if (err instanceof ImportError) throw err;
    if (err instanceof PullError) throw new ImportError(err.cause.code, err.cause.message);
    if (err instanceof GithubApiError) throw new ImportError(err.code, err.message);
    throw new ImportError('unknown', String(err));
  }
}