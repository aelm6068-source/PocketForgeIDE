// src/ai/projectContext.ts
// تعليمات النظام للذكاء الاصطناعي: اسم المشروع + مسارات ملفاته (من غير محتواها).
import { translate } from '../i18n/translate';
import { classifyPath } from '../github/ignore';
import type { ProjectFile } from '../screens/editor/useEditorFile';

const MAX_PATHS = 300;

// مسارات الملفات (من غير node_modules وأمثالها) بترتيب أبجدي
export function listProjectPaths(files: ProjectFile[]): string[] {
  const byId = new Map(files.map((f) => [f.id, f]));
  const out: string[] = [];
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
    if (classifyPath(path) === 'include') out.push(path);
  }
  return out.sort();
}

export function buildSystemPrompt(projectName: string, files: ProjectFile[]): string {
  const paths = listProjectPaths(files);
  const shown = paths.slice(0, MAX_PATHS).join(', ');
  const more = paths.length > MAX_PATHS ? ` (+${paths.length - MAX_PATHS} more)` : '';
  return translate('ai_sys_prompt', { name: projectName, files: (shown || '-') + more });
}