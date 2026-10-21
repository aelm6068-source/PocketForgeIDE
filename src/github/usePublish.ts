// src/github/usePublish.ts
// hook نافذة "رفع إلى GitHub": بيجهّز لقطة المشروع، بيتحقق من الحساب والاسم،
// وبينفذ الرفع ويحفظ ربط المشروع بالمستودع.
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadProjectFiles, loadFileContent } from '../utils/projectStorage';
import { getGithubToken } from './tokenStore';
import { loadGithubLink, saveGithubLink, GithubLink } from './linkStore';
import { buildSnapshot, Snapshot } from './snapshot';
import { publishToGithub, PublishError, PublishProgress, ExistingRepo } from './publish';
import { checkRepoName, nextRepoName, suggestRepoName } from './repoName';
import type { ApiErrorCode } from './api';

export type PublishUi =
  | { kind: 'checking' }
  | { kind: 'need_login' }
  | { kind: 'linked'; link: GithubLink }
  | { kind: 'empty' }
  | { kind: 'form' }
  | { kind: 'working'; progress: PublishProgress | null }
  | { kind: 'done'; link: GithubLink }
  | { kind: 'error'; code: ApiErrorCode; canRetry: boolean };

export type NameError = 'empty' | 'too_long' | 'invalid' | 'name_taken' | null;

const DEFAULT_MESSAGE = 'Initial commit from PocketForge';

export function usePublish(visible: boolean, projectId: string, projectName: string) {
  const [ui, setUi] = useState<PublishUi>({ kind: 'checking' });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [nameError, setNameError] = useState<NameError>(null);

  // مستودع اتعمل فعلًا بس الرفع وقف في النص: المحاولة التانية تكمل عليه
  const pending = useRef<ExistingRepo | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const id = ++runId.current;
    const alive = () => runId.current === id;
    pending.current = null;
    setUi({ kind: 'checking' });
    setSnapshot(null);
    setNameError(null);
    setIsPrivate(true);
    setName(suggestRepoName(projectName));

    (async () => {
      const link = await loadGithubLink(projectId);
      if (!alive()) return;
      if (link) {
        setUi({ kind: 'linked', link });
        return;
      }
      const token = await getGithubToken();
      if (!alive()) return;
      if (!token) {
        setUi({ kind: 'need_login' });
        return;
      }
      const nodes = (await loadProjectFiles(projectId)) ?? [];
      const snap = await buildSnapshot(nodes, (fileId) => loadFileContent(projectId, fileId));
      if (!alive()) return;
      setSnapshot(snap);
      setUi(snap.entries.length === 0 ? { kind: 'empty' } : { kind: 'form' });
    })().catch(() => {
      if (alive()) setUi({ kind: 'error', code: 'unknown', canRetry: false });
    });

    return () => {
      runId.current += 1;
    };
  }, [visible, projectId, projectName]);

  const changeName = useCallback((value: string) => {
    setName(value);
    setNameError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!snapshot || (ui.kind !== 'form' && ui.kind !== 'error')) return;
    const trimmed = name.trim();
    const check = checkRepoName(trimmed);
    if (check !== 'ok' && !pending.current) {
      setNameError(check);
      setUi({ kind: 'form' });
      return;
    }
    const token = await getGithubToken();
    if (!token) {
      setUi({ kind: 'need_login' });
      return;
    }
    const id = runId.current;
    setNameError(null);
    setUi({ kind: 'working', progress: null });
    try {
      const result = await publishToGithub(
        { token },
        {
          newRepo: pending.current ? undefined : { name: trimmed, description: projectName, isPrivate },
          existing: pending.current ?? undefined,
          message: DEFAULT_MESSAGE,
          entries: snapshot.entries,
        },
        (progress) => {
          if (runId.current === id) setUi({ kind: 'working', progress });
        }
      );
      const link: GithubLink = {
        owner: result.owner,
        repo: result.repo,
        branch: result.branch,
        htmlUrl: result.htmlUrl,
        isPrivate: result.isPrivate,
        headSha: result.commitSha,
        files: result.blobShas,
      };
      await saveGithubLink(projectId, link);
      pending.current = null;
      if (runId.current === id) setUi({ kind: 'done', link });
    } catch (err) {
      if (runId.current !== id) return;
      const failure = err instanceof PublishError ? err : null;
      const code: ApiErrorCode = failure?.cause.code ?? 'unknown';
      if (failure?.created) pending.current = failure.created;
      if (code === 'name_taken') {
        setName(nextRepoName(trimmed));
        setNameError('name_taken');
        setUi({ kind: 'form' });
        return;
      }
      setUi({ kind: 'error', code, canRetry: code !== 'unauthorized' });
    }
  }, [snapshot, ui.kind, name, isPrivate, projectId, projectName]);

  return { ui, snapshot, name, changeName, isPrivate, setIsPrivate, nameError, submit };
}