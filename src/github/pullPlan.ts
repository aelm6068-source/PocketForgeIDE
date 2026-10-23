// src/github/pullPlan.ts
// خطة السحب: مقارنة ثلاثية لكل ملف بين
//   base   = النسخة اللي اتزامنّا عليها آخر مرة (link.files)
//   local  = اللي عندك دلوقتي
//   remote = اللي على GitHub دلوقتي
// القاعدة (sha غايب = الملف مش موجود):
//   remote == base  -> مفيش تغيير من GitHub، سيبه
//   local  == base  -> انت ما لمستوش، خد نسخة GitHub (كتابة أو حذف)
//   local  == remote-> الاتنين عملوا نفس التغيير، مفيش حاجة تتعمل
//   غير كده         -> تعارض، المستخدم يختار
import { classifyPath } from './ignore';

export const MAX_PULL_FILE_BYTES = 20 * 1024 * 1024;

export interface RemoteFile {
  path: string;
  sha: string;
  size: number;
}

export type PullSkipReason = 'too_large' | 'binary' | 'secret' | 'path_conflict';

export interface PullSkip {
  path: string;
  reason: PullSkipReason;
}

export interface PullWrite {
  path: string;
  sha: string;
}

export interface PullConflict {
  path: string;
  // null = اتحذف على GitHub
  remoteSha: string | null;
  // انت حذفته عندك
  localDeleted: boolean;
}

export interface PullPlan {
  writes: PullWrite[];
  deletes: string[];
  conflicts: PullConflict[];
  skipped: PullSkip[];
  // خريطة base الجديدة (قبل ما نطبّق قرارات التعارض وحالات التخطي)
  remoteMap: Record<string, string>;
}

export type Choice = 'mine' | 'theirs';

export function planPull(
  base: Record<string, string>,
  local: Record<string, string>,
  remote: RemoteFile[]
): PullPlan {
  const remoteMap: Record<string, string> = {};
  const skipped: PullSkip[] = [];
  const unknown = new Set<string>();
  for (const f of remote) {
    if (classifyPath(f.path) !== 'include') continue;
    if (f.size > MAX_PULL_FILE_BYTES) {
      skipped.push({ path: f.path, reason: 'too_large' });
      unknown.add(f.path);
      continue;
    }
    remoteMap[f.path] = f.sha;
  }

  const paths = new Set<string>([...Object.keys(base), ...Object.keys(local), ...Object.keys(remoteMap)]);
  const writes: PullWrite[] = [];
  const deletes: string[] = [];
  const conflicts: PullConflict[] = [];
  for (const path of [...paths].sort()) {
    if (unknown.has(path)) continue;
    const b = base[path];
    const l = local[path];
    const r = remoteMap[path];
    if (r === b) continue;
    if (l === b) {
      if (r === undefined) deletes.push(path);
      else writes.push({ path, sha: r });
      continue;
    }
    if (l === r) continue;
    conflicts.push({ path, remoteSha: r ?? null, localDeleted: l === undefined });
  }
  return { writes, deletes, conflicts, skipped, remoteMap };
}

// بيطبّق قرارات المستخدم على التعارضات: "theirs" بتتحوّل لكتابة/حذف، و"mine" بتتساب.
// الافتراضي "mine" (مبنمسحش شغلك المحلي من غير ما تقول).
export function resolveConflicts(
  plan: PullPlan,
  choices: Record<string, Choice>
): { writes: PullWrite[]; deletes: string[] } {
  const writes = [...plan.writes];
  const deletes = [...plan.deletes];
  for (const c of plan.conflicts) {
    if (choices[c.path] !== 'theirs') continue;
    if (c.remoteSha === null) deletes.push(c.path);
    else writes.push({ path: c.path, sha: c.remoteSha });
  }
  return { writes, deletes };
}

// خريطة base بعد السحب: هي نفسها نسخة GitHub، إلا الملفات اللي ما قدرناش ننزّلها
// (ثنائية/فيها مفتاح/كبيرة/مسار متعارض): دي بتفضل زي ما كانت في base.
export function nextBase(
  plan: PullPlan,
  base: Record<string, string>,
  failed: PullSkip[]
): Record<string, string> {
  const out: Record<string, string> = { ...plan.remoteMap };
  const keep = new Set<string>([...plan.skipped.map((s) => s.path), ...failed.map((s) => s.path)]);
  for (const p of keep) {
    if (base[p] === undefined) delete out[p];
    else out[p] = base[p];
  }
  return out;
}