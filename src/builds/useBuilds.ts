// src/builds/useBuilds.ts
// حالة تاب البناء لمشروع: الربط، وجود ملف البناء، آخر التشغيلات (بتتحدّث لوحدها وقت ما في بناء شغال).
import { useCallback, useEffect, useRef, useState } from 'react';
import { GithubApiError } from '../github/api';
import { loadGithubLink, saveGithubLink, type GithubLink } from '../github/linkStore';
import { getGithubToken } from '../github/tokenStore';
import { getApk, getFailedStep, getWorkflowSha, listRuns, type ApkInfo, type RunInfo } from './api';
import { hasActiveRun, refOf, setupBuild, startBuild } from './service';

export type BuildsStatus = 'loading' | 'no_token' | 'no_link' | 'ready';
export interface RunView extends RunInfo {
  failedStep?: string | null;
  apk?: ApkInfo | null;
}

const POLL_MS = 15000;

export function useBuilds(projectId: string, active: boolean) {
  const [status, setStatus] = useState<BuildsStatus>('loading');
  const [link, setLink] = useState<GithubLink | null>(null);
  const [hasWorkflow, setHasWorkflow] = useState(false);
  const [runs, setRuns] = useState<RunView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GithubApiError | null>(null);
  const details = useRef(new Map<number, { failedStep?: string | null; apk?: ApkInfo | null }>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const token = await getGithubToken();
      const l = await loadGithubLink(projectId);
      if (!alive.current) return;
      setLink(l);
      if (!token) return setStatus('no_token');
      if (!l) return setStatus('no_link');
      const ctx = { token };
      const r = refOf(l);
      const sha = await getWorkflowSha(ctx, r);
      setHasWorkflow(sha !== null);
      let list: RunView[] = [];
      if (sha !== null) {
        const raw = await listRuns(ctx, r);
        // تفاصيل التشغيلات المنتهية بتتجاب مرة واحدة وتتخزّن
        list = await Promise.all(
          raw.map(async (run) => {
            if (run.state !== 'failed' && run.state !== 'success') return run;
            if (!details.current.has(run.id)) {
              try {
                details.current.set(
                  run.id,
                  run.state === 'failed' ? { failedStep: await getFailedStep(ctx, r, run.id) } : { apk: await getApk(ctx, r, run.number) }
                );
              } catch {
                return run; // هنحاول تاني في التحديث الجاي
              }
            }
            return { ...run, ...details.current.get(run.id) };
          })
        );
      }
      if (!alive.current) return;
      setRuns(list);
      setError(null);
      setStatus('ready');
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof GithubApiError ? e : new GithubApiError('unknown'));
      setStatus((s) => (s === 'loading' ? 'ready' : s));
    }
  }, [projectId]);

  // تحديث أول ما التاب يتفتح، وبعدين كل 15 ثانية لو في بناء شغال
  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);
  const running = hasActiveRun(runs.map((r) => r.state));
  useEffect(() => {
    if (!active || !running) return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [active, running, refresh]);

  const guarded = useCallback(
    async (fn: (token: string, l: GithubLink) => Promise<void>) => {
      if (busy || !link) return;
      setBusy(true);
      setError(null);
      try {
        const token = await getGithubToken();
        if (!token) throw new GithubApiError('unauthorized', 401);
        await fn(token, link);
      } catch (e) {
        setError(e instanceof GithubApiError ? e : new GithubApiError('unknown'));
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [busy, link]
  );

  const setup = useCallback(
    () =>
      guarded(async (token, l) => {
        const res = await setupBuild({ token }, l);
        if (res.newHeadSha) await saveGithubLink(projectId, { ...l, headSha: res.newHeadSha });
        await refresh();
      }),
    [guarded, projectId, refresh]
  );

  const build = useCallback(
    () =>
      guarded(async (token, l) => {
        await startBuild({ token }, l);
        // التشغيل بيظهر في القايمة بعد ثواني
        for (let i = 0; i < 4; i++) {
          await new Promise((r) => setTimeout(r, 4000));
          await refresh();
        }
      }),
    [guarded, refresh]
  );

  return { status, link, hasWorkflow, runs, busy, error, running, refresh, setup, build };
}
