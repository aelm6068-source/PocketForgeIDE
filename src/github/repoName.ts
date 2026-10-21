// src/github/repoName.ts
// أسماء مستودعات GitHub: حروف إنجليزية وأرقام و - و _ و . بس، لحد 100 حرف،
// ومينفعش يكون "." أو ".." أو ينتهي بـ ".git". اسم المشروع ممكن يكون عربي،
// فبنحوله لاسم صالح ونقترحه على المستخدم يعدله.

const MAX_LENGTH = 100;
export const FALLBACK_REPO_NAME = 'pocketforge-project';

export type RepoNameCheck = 'ok' | 'empty' | 'too_long' | 'invalid';

export function suggestRepoName(projectName: string): string {
  let slug = projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');
  if (slug.length > MAX_LENGTH) slug = slug.slice(0, MAX_LENGTH).replace(/[-._]+$/g, '');
  if (slug.toLowerCase().endsWith('.git')) slug = slug.slice(0, -4).replace(/[-._]+$/g, '');
  return slug || FALLBACK_REPO_NAME;
}

export function checkRepoName(name: string): RepoNameCheck {
  const n = name.trim();
  if (!n) return 'empty';
  if (n.length > MAX_LENGTH) return 'too_long';
  if (n === '.' || n === '..') return 'invalid';
  if (n.toLowerCase().endsWith('.git')) return 'invalid';
  if (!/^[A-Za-z0-9._-]+$/.test(n)) return 'invalid';
  return 'ok';
}

// لو الاسم محجوز: my-app -> my-app-2 -> my-app-3 ...
export function nextRepoName(name: string): string {
  const m = /^(.*?)-(\d+)$/.exec(name);
  if (m && m[1]) return `${m[1]}-${Number(m[2]) + 1}`;
  return `${name}-2`;
}