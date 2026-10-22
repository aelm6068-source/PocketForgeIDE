// src/github/useGithubSync.ts
// hook لوحة التحديث على مشروع مربوط بمستودع: بيحسب التغييرات من آخر رفع،
// بيتأكد إن GitHub مفيهوش تغييرات أحدث، وبيرفع التعديلات في commit جديد.
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadProjectFiles, loadFileContent } from '../utils/projectStorage';
import { getGithubToken } from './tokenStore';
import { saveGithubLink, GithubLink } from './linkStore';
import { buildSnapshot } from './snapshot';
import { hashEntries, diffEntries, countChanges, ChangeSet, HashedEntry } from './diff';
import { pushUpdate, UpdateError, UpdateProgress } from './update';
import { getBranchHead } from './api';
import type { ApiErrorCode } from './api';

export type SyncUi =
  | { kind: 'checking' }
  | { kind: 'clean' }
  | { kind: 'changes' }
  | { kind: 'pushing'; progress: UpdateProgress | null }
  | { kind: 'pushed' }
  | { kind: 'error'; code: ApiErrorCode | 'need_login'; canRetry: boolean };

const DEFAULT_MESSAGE = 'Update from PocketForge';

export function useGithubSync(active: boolean, projectId: string, initialLink: GithubLink) {
  const [ui, setUi] = useState<SyncUi>({ kind: 'checking' });
  const [link, setLink] = useState<GithubLink>(initialLink);
  const [changes, setChanges] = useState<ChangeSet | null>(null);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  // GitHub فيه commits أحدث من اللي إحنا واقفين عليه
  const [remoteAhead, setRemoteAhead] = useState(false);

  const entriesRef = useRef<HashedEntry[]>([]);
  const runId = useRef(0);

  const load = useCallback(async (baseLink: GithubLink) => {
    const id = ++runId.current;
    const alive = () => runId.current === id;
    setUi({ kind: 'checking' });
    setChanges(null);
    try {
      const nodes = (await loadProjectFiles(projectId)) ?? [];
      const snap = await buildSnapshot(nodes, (fileId) => loadFileContent(projectId, fileId));
      const hashed = await hashEntries(snap.entries);
      if (!alive()) return;
      entriesRef.current = hashed;
      const diff = diffEntries(hashed, baseLink.files);
      setChanges(diff);
      setUi(countChanges(diff) === 0 ? { kind: 'clean' } : { kind: 'changes' });

      // فحص GitHub (لو مفيش نت أو توكن، بنتجاهل الفحص ده بس)
      const token = await getGithubToken();
      if (!token || !alive()) return;
      try {
        const head = await getBranchHead({ token }, baseLink.owner, baseLink.repo, baseLink.branch, 1);
        if (alive()) setRemoteAhead(head !== baseLink.headSha);
      } catch {
        // مش مشكلة: الرفع نفسه هيفحص تاني
      }
    } catch {
      if (alive()) setUi({ kind: 'error', code: 'unknown', canRetry: true });
    }
  }, [projectId]);

  useEffect(() => {
    if (!active) return;
    setLink(initialLink);
    setMessage(DEFAULT_MESSAGE);
    setRemoteAhead(false);
    void load(initialLink);
    return () => {
      runId.current += 1;
    };
    // initialLink ممكن يتغير شكله بس مش محتوى، فبنعتمد على العناصر الثابتة
  }, [active, projectId, initialLink.owner, initialLink.repo, initialLink.headSha, load]);

  const push = useCallback(async () => {
    if (!changes || countChanges(changes) === 0) return;
    const token = await getGithubToken();
    if (!token) {
      setUi({ kind: 'error', code: 'need_login', canRetry: false });
      return;
    }
    const id = runId.current;
    setUi({ kind: 'pushing', progress: null });
    try {
      const result = await pushUpdate(
        { token },
        {
          owner: link.owner,
          repo: link.repo,
          branch: link.branch,
          baseHead: link.headSha,
          message: message.trim() || DEFAULT_MESSAGE,
          changes,
          allEntries: entriesRef.current,
        },
        (progress) => {
          if (runId.current === id) setUi({ kind: 'pushing', progress });
        }
      );
      const next: GithubLink = { ...link, headSha: result.commitSha, files: result.files };
      await saveGithubLink(projectId, next);
      if (runId.current !== id) return;
      setLink(next);
      setChanges(null);
      setRemoteAhead(false);
      setUi({ kind: 'pushed' });
    } catch (err) {
      if (runId.current !== id) return;
      const code = err instanceof UpdateError ? err.cause.code : 'unknown';
      if (code === 'diverged') setRemoteAhead(true);
      setUi({
        kind: 'error',
        code,
        canRetry: code !== 'unauthorized' && code !== 'diverged',
      });
    }
  }, [changes, link, message, projectId]);

  const reload = useCallback(() => load(link), [load, link]);

  return { ui, link, changes, message, setMessage, remoteAhead, push, reload };
}
