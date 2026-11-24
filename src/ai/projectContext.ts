// src/ai/projectContext.ts
// تعليمات النظام للذكاء الاصطناعي: اسم المشروع + مسارات ملفاته (من غير محتواها).
import { translate } from '../i18n/translate';
import { classifyPath } from '../github/ignore';
import type { ProjectFile } from '../screens/editor/useEditorFile';

const MAX_PATHS = 300;

export interface PathEntry {
  id: string;
  path: string;
}

// الملفات (من غير node_modules وأمثالها) بمساراتها وبترتيب أبجدي
export function listProjectEntries(files: ProjectFile[]): PathEntry[] {
  const byId = new Map(files.map((f) => [f.id, f]));
  const out: PathEntry[] = [];
  for (const f of files) {
    if (f.type !== 'file') continue;
    const parts: string[] = [];
    let cur: ProjectFile | undefined = f;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    const path = parts.join('/');
    if (classifyPath(path) === 'include') out.push({ id: f.id, path });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function listProjectPaths(files: ProjectFile[]): string[] {
  return listProjectEntries(files).map((e) => e.path);
}

export function buildSystemPrompt(projectName: string, files: ProjectFile[]): string {
  const paths = listProjectPaths(files);
  const shown = paths.slice(0, MAX_PATHS).join(', ');
  const more = paths.length > MAX_PATHS ? ` (+${paths.length - MAX_PATHS} more)` : '';
  return translate('ai_sys_prompt', { name: projectName, files: (shown || '-') + more });
}
