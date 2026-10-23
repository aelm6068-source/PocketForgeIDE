// src/github/useGithubPull.ts
// hook سحب التغييرات من GitHub لمشروع مربوط: بيقارن ملفاتك بنسخة GitHub، بيعرض
// الخطة (وأي تعارض) للمستخدم، وبعد التأكيد بينزّل الملفات ويطبّقها على المشروع.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteFileContent,
  loadFileContent,
  loadProjectFiles,
  saveFileContent,
  saveProjectFiles,
  touchProject,
} from '../utils/projectStorage';
import { emitProjectFilesChanged } from '../utils/projectEvents';
import { getGithubToken } from './tokenStore';
import { saveGithubLink } from './linkStore';
import type { GithubLink } from './linkStore';
import { buildSnapshot } from './snapshot';
import { hashEntries } from './diff';
import { planPull } from './pullPlan';
import type { Choice, PullPlan, PullSkip } from './pullPlan';
import { executePull, fetchRemoteState, PullError } from './pull';
import type { PullProgress, RemoteState } from './pull';
import type { ApiErrorCode } from './api';

export type PullUi =
  | { kind: 'idle' }
  | { kind: 'planning' }
  | { kind: 'review' }
  | { kind: 'pulling'; progress: PullProgress | null }
  | { kind: 'done'; written: number; deleted: number; skipped: PullSkip[] }
  | { kind: 'error'; code: ApiErrorCode | 'need_login'; canRetry: boolean };

export function useGithubPull(
  active: boolean,
  projectId: string,
  link: GithubLink,
  onPulled: (next: GithubLink) => void
) {
  const [ui, setUi] = useState<PullUi>({ kind: 'idle' });
  const [plan, setPlan] = useState<PullPlan | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const remoteRef = useRef<RemoteState | null>(null);
  const runId = useRef(0);

  // لما النافذة تتقفل أو المشروع يتغير، نلغي أي عملية شغالة ونرجع للبداية
  useEffect(() => {
    runId.current += 1;
    setUi({ kind: 'idle' });
    setPlan(null);
    setChoices({});
    remoteRef.current = null;
    return () => {
      runId.current += 1;
    };
  }, [active, projectId]);

  const reset = useCallback(() => {
    runId.current += 1;
    setUi({ kind: 'idle' });
    setPlan(null);
    setChoices({});
    remoteRef.current = null;
  }, []);

  const apply = useCallback(
    async (thePlan: PullPlan, theChoices: Record<string, Choice>, remote: RemoteState, token: string) => {
      const id = runId.current;
      setUi({ kind: 'pulling', progress: null });
      try {
        // بنقرا قايمة الملفات من جديد قبل التطبيق (احتياطًا لو اتغيرت)
        const nodes = (await loadProjectFiles(projectId)) ?? [];
        const result = await executePull(
          { token },
          {
            owner: link.owner,
            repo: link.repo,
            nodes,
            plan: thePlan,
            choices: theChoices,
            baseFiles: link.files,
            remoteHead: remote.head,
          },
          {
            writeContent: (fileId, content) => saveFileContent(projectId, fileId, content),
            deleteContent: (fileId) => deleteFileContent(projectId, fileId),
          },
          (progress) => {
            if (runId.current === id) setUi({ kind: 'pulling', progress });
          }
        );
        await saveProjectFiles(projectId, result.nodes);
        const next: GithubLink = { ...link, headSha: result.headSha, files: result.files };
        await saveGithubLink(projectId, next);
        touchProject(projectId);
        emitProjectFilesChanged(projectId);
        if (runId.current !== id) return;
        setUi({ kind: 'done', written: result.writtenCount, deleted: result.deletedCount, skipped: result.skipped });
        onPulled(next);
      } catch (err) {
        if (runId.current !== id) return;
        const code = err instanceof PullError ? err.cause.code : 'unknown';
        setUi({ kind: 'error', code, canRetry: code !== 'unauthorized' });
      }
    },
    [projectId, link, onPulled]
  );

  const start = useCallback(async () => {
    const token = await getGithubToken();
    if (!token) {
      setUi({ kind: 'error', code: 'need_login', canRetry: false });
      return;
    }
    const id = ++runId.current;
    const alive = () => runId.current === id;
    setUi({ kind: 'planning' });
    try {
      const nodes = (await loadProjectFiles(projectId)) ?? [];
      const snap = await buildSnapshot(nodes, (fileId) => loadFileContent(projectId, fileId));
      const hashed = await hashEntries(snap.entries);
      const local: Record<string, string> = {};
      for (const e of hashed) local[e.path] = e.sha;
      const remote = await fetchRemoteState({ token }, link);
      if (!alive()) return;
      const thePlan = planPull(link.files, local, remote.files);
      remoteRef.current = remote;
      setPlan(thePlan);
      setChoices({});
      const nothing = thePlan.writes.length === 0 && thePlan.deletes.length === 0 && thePlan.conflicts.length === 0;
      if (nothing) {
        // مفيش حاجة تتنزّل (التغييرات على GitHub في ملفات مش بنستوردها)، بس لازم نحدّث نقطة المزامنة
        await apply(thePlan, {}, remote, token);
      } else {
        setUi({ kind: 'review' });
      }
    } catch (err) {
      if (!alive()) return;
      const code: ApiErrorCode = (err as { code?: ApiErrorCode })?.code ?? 'unknown';
      setUi({ kind: 'error', code, canRetry: true });
    }
  }, [projectId, link, apply]);

  const confirm = useCallback(async () => {
    const remote = remoteRef.current;
    if (!plan || !remote) return;
    const token = await getGithubToken();
    if (!token) {
      setUi({ kind: 'error', code: 'need_login', canRetry: false });
      return;
    }
    await apply(plan, choices, remote, token);
  }, [plan, choices, apply]);

  const setChoice = useCallback((path: string, choice: Choice) => {
    setChoices((prev) => ({ ...prev, [path]: choice }));
  }, []);

  const setAll = useCallback(
    (choice: Choice) => {
      if (!plan) return;
      const next: Record<string, Choice> = {};
      for (const c of plan.conflicts) next[c.path] = choice;
      setChoices(next);
    },
    [plan]
  );

  return { ui, plan, choices, start, confirm, reset, setChoice, setAll };
}

export type GithubPull = ReturnType<typeof useGithubPull>;