// src/github/useGithubImport.ts
// hook استيراد مشروع من GitHub: بيجيب قايمة مستودعات الحساب، وبعد ما المستخدم يختار
// واحد بينشئ مشروع جديد بملفاته ويربطه بالمستودع (فالسحب والرفع بيشتغلوا عليه على طول).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteProjectData, saveFileContent, saveProjectFiles, deleteFileContent } from '../utils/projectStorage';
import { getGithubToken } from './tokenStore';
import { clearGithubLink, saveGithubLink } from './linkStore';
import { listUserRepos } from './api';
import type { ApiErrorCode, RepoListItem } from './api';
import { importRepo, ImportError } from './importRepo';
import type { ImportLanguage, ImportProgress } from './importRepo';
import type { PullSkip } from './pullPlan';

export interface ImportedProject {
  id: string;
  name: string;
  language: ImportLanguage;
}

export type ImportErrorCode = ApiErrorCode | 'need_login' | 'repo_empty' | 'no_files' | 'too_big';

export type ImportUi =
  | { kind: 'loading' }
  | { kind: 'list' }
  | { kind: 'importing'; repo: string; progress: ImportProgress | null }
  | { kind: 'done'; project: ImportedProject; fileCount: number; skipped: PullSkip[] }
  | { kind: 'error'; code: ImportErrorCode; stage: 'list' | 'import'; canRetry: boolean };

export const MAX_LISTED_REPOS = 100;

export function useGithubImport(visible: boolean, onImported: (project: ImportedProject) => void) {
  const [ui, setUi] = useState<ImportUi>({ kind: 'loading' });
  const [repos, setRepos] = useState<RepoListItem[]>([]);
  const [query, setQuery] = useState('');
  const runId = useRef(0);
  const lastPick = useRef<RepoListItem | null>(null);

  const loadRepos = useCallback(async () => {
    const id = ++runId.current;
    const alive = () => runId.current === id;
    setUi({ kind: 'loading' });
    const token = await getGithubToken();
    if (!token) {
      if (alive()) setUi({ kind: 'error', code: 'need_login', stage: 'list', canRetry: false });
      return;
    }
    try {
      const list = await listUserRepos({ token });
      if (!alive()) return;
      setRepos(list);
      setUi({ kind: 'list' });
    } catch (err) {
      if (!alive()) return;
      const code: ApiErrorCode = (err as { code?: ApiErrorCode })?.code ?? 'unknown';
      setUi({ kind: 'error', code, stage: 'list', canRetry: code !== 'unauthorized' });
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      runId.current += 1;
      return;
    }
    setQuery('');
    setRepos([]);
    void loadRepos();
    return () => {
      runId.current += 1;
    };
  }, [visible, loadRepos]);

  const pick = useCallback(
    async (repo: RepoListItem) => {
      lastPick.current = repo;
      const token = await getGithubToken();
      if (!token) {
        setUi({ kind: 'error', code: 'need_login', stage: 'import', canRetry: false });
        return;
      }
      const id = ++runId.current;
      const alive = () => runId.current === id;
      const projectId = Date.now().toString();
      setUi({ kind: 'importing', repo: repo.name, progress: null });
      try {
        const result = await importRepo(
          { token },
          { owner: repo.owner, repo: repo.name, branch: repo.defaultBranch },
          {
            writeContent: (fileId, content) => saveFileContent(projectId, fileId, content),
            deleteContent: (fileId) => deleteFileContent(projectId, fileId),
          },
          (progress) => {
            if (alive()) setUi({ kind: 'importing', repo: repo.name, progress });
          }
        );
        await saveProjectFiles(projectId, result.nodes);
        await saveGithubLink(projectId, {
          owner: repo.owner,
          repo: repo.name,
          branch: repo.defaultBranch,
          htmlUrl: repo.htmlUrl,
          isPrivate: repo.isPrivate,
          headSha: result.headSha,
          files: result.files,
        });
        const project: ImportedProject = { id: projectId, name: repo.name, language: result.language };
        // المشروع اتحفظ فعلًا، فنضيفه لقايمة المشاريع حتى لو المستخدم قفل النافذة
        onImported(project);
        if (alive()) setUi({ kind: 'done', project, fileCount: result.fileCount, skipped: result.skipped });
      } catch (err) {
        // فشل في النص: نمسح أي حاجة اتكتبت عشان ميفضلش مشروع نصف مستورد
        await deleteProjectData(projectId);
        await clearGithubLink(projectId);
        if (!alive()) return;
        const code: ImportErrorCode = err instanceof ImportError ? err.code : 'unknown';
        const canRetry = code !== 'unauthorized' && code !== 'repo_empty' && code !== 'no_files' && code !== 'too_big';
        setUi({ kind: 'error', code, stage: 'import', canRetry });
      }
    },
    [onImported]
  );

  const retry = useCallback(() => {
    if (ui.kind === 'error' && ui.stage === 'import' && lastPick.current) void pick(lastPick.current);
    else void loadRepos();
  }, [ui, pick, loadRepos]);

  const backToList = useCallback(() => {
    setUi({ kind: 'list' });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? repos.filter((r) => `${r.owner}/${r.name}`.toLowerCase().includes(q)) : repos;
  }, [repos, query]);

  return { ui, repos, filtered, query, setQuery, pick, retry, backToList };
}