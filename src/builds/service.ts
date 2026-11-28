// src/builds/service.ts
// منطق تجهيز وتشغيل البناء (من غير React). بيتشارك بين الواجهة والاختبارات.
import { getBranchHead, type GhCtx } from '../github/api';
import type { GithubLink } from '../github/linkStore';
import { dispatchBuild, getWorkflowSha, putWorkflow, type RepoRef } from './api';
import { buildWorkflowYaml } from './workflow';

export const refOf = (l: GithubLink): RepoRef => ({ owner: l.owner, repo: l.repo, branch: l.branch });

export interface SetupResult {
  commitSha: string;
  // لو الفرع كان على نفس commit المزامنة قبل الكتابة، نقدر نحدّث headSha بأمان
  newHeadSha: string | null;
}

// بيكتب ملف البناء. headSha بيتحدّث بس لو المستودع ماكنش اتغيّر من بره (علشان المزامنة تفضل بتكشف التعارض صح).
export async function setupBuild(ctx: GhCtx, link: GithubLink): Promise<SetupResult> {
  const r = refOf(link);
  const before = await getBranchHead(ctx, r.owner, r.repo, r.branch, 1);
  const sha = await getWorkflowSha(ctx, r);
  const commitSha = await putWorkflow(ctx, r, buildWorkflowYaml(), sha);
  return { commitSha, newHeadSha: before === link.headSha ? commitSha : null };
}

export async function startBuild(ctx: GhCtx, link: GithubLink): Promise<void> {
  await dispatchBuild(ctx, refOf(link));
}

export function hasActiveRun(states: string[]): boolean {
  return states.some((s) => s === 'queued' || s === 'running');
}
