// src/github/ignore.ts
// إيه اللي ميترفعش على GitHub: ملفات مولّدة (node_modules...) وملفات الأسرار.
// الأسرار بنستبعدها تلقائيًا (من الاسم أو من شكل المحتوى) عشان مفتاح ميتسربش
// بالغلط لمستودع عام. الاستبعاد بيتعرض للمستخدم بالاسم.

export type PathVerdict = 'include' | 'ignore' | 'secret';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.expo',
  '.gradle',
  '.idea',
  'dist',
  'web-build',
]);
const IGNORED_FILES = new Set(['.ds_store', 'thumbs.db']);
const SECRET_EXTENSIONS = new Set(['pem', 'key', 'p12', 'pfx', 'jks', 'keystore', 'mobileprovision']);
const SECRET_NAMES = new Set(['id_rsa', 'id_ed25519', 'id_ecdsa']);
const ENV_SAFE_SUFFIXES = ['.example', '.sample', '.template'];

export function classifyPath(path: string): PathVerdict {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return 'ignore';
  const base = parts[parts.length - 1].toLowerCase();

  for (let i = 0; i < parts.length - 1; i++) {
    if (IGNORED_DIRS.has(parts[i])) return 'ignore';
  }
  if (IGNORED_FILES.has(base) || base.endsWith('.log')) return 'ignore';

  if (base === '.env' || base.startsWith('.env.')) {
    return ENV_SAFE_SUFFIXES.some((s) => base.endsWith(s)) ? 'include' : 'secret';
  }
  if (SECRET_NAMES.has(base)) return 'secret';
  const dot = base.lastIndexOf('.');
  if (dot >= 0 && SECRET_EXTENSIONS.has(base.slice(dot + 1))) return 'secret';
  return 'include';
}

// أنماط مفاتيح معروفة. ضيقة قصدًا عشان ملف عادي ميتستبعدش بالغلط.
const SECRET_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { label: 'github-token', re: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { label: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { label: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { label: 'api-key', re: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { label: 'daytona-key', re: /\bdtn_[A-Za-z0-9]{20,}\b/ },
  { label: 'e2b-key', re: /\be2b_[A-Za-z0-9]{30,}\b/ },
];

// بترجّع اسم نوع المفتاح لو لقت واحد، أو null
export function findSecretInText(text: string): string | null {
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(text)) return p.label;
  }
  return null;
}