// أدوات المسارات (مسارات مطلقة تبدأ بـ / والجذر = جذر المشروع)

export function splitPath(p: string): string[] {
  return p.split('/').filter((s) => s !== '' && s !== '.');
}

export function resolvePath(cwd: string, input: string): string {
  const out: string[] = input.startsWith('/') ? [] : splitPath(cwd);
  for (const seg of input.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return '/' + out.join('/');
}

export function baseName(abs: string): string {
  const s = splitPath(abs);
  return s.length ? s[s.length - 1] : '';
}

export function parentPath(abs: string): string {
  const s = splitPath(abs);
  s.pop();
  return '/' + s.join('/');
}

export function joinPath(dir: string, name: string): string {
  return dir === '/' ? '/' + name : dir + '/' + name;
}