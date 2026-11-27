// src/libs/pkgJson.ts
// منطق بحت لتعديل package.json بتاع المشروع (إضافة/حذف/عرض اعتماديات) وتقدير خطر المكتبة. من غير شبكة.
export interface DepEntry {
  name: string;
  range: string;
  dev: boolean;
}
export type Risk = 'js' | 'native' | 'unknown';

const NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
export function validPkgName(name: string): boolean {
  return name.length > 0 && name.length <= 214 && NAME_RE.test(name);
}

// "react-query@5.1" / "@scope/pkg@^2" / "lodash" -> {name, version?}
export function parseSpec(spec: string): { name: string; version?: string } | null {
  const s = spec.trim();
  if (!s) return null;
  const at = s.lastIndexOf('@');
  const name = at > 0 ? s.slice(0, at) : s;
  const version = at > 0 ? s.slice(at + 1) : undefined;
  if (!validPkgName(name)) return null;
  if (version !== undefined && (!version || /\s/.test(version))) return null;
  return { name, version };
}

export type ParsedPkg = { ok: true; obj: Record<string, any> } | { ok: false };
export function parsePkg(text: string): ParsedPkg {
  try {
    const o = JSON.parse(text);
    if (o && typeof o === 'object' && !Array.isArray(o)) return { ok: true, obj: o };
  } catch {
    /* ignore */
  }
  return { ok: false };
}

function sortedObject(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function listDeps(obj: Record<string, any>): DepEntry[] {
  const out: DepEntry[] = [];
  for (const [key, dev] of [['dependencies', false], ['devDependencies', true]] as const) {
    const d = obj[key];
    if (d && typeof d === 'object') for (const [name, range] of Object.entries(d)) out.push({ name, range: String(range), dev });
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// بيرجّع نص package.json بعد الإضافة (بنفس تنسيق 2 مسافة)
export function addDep(text: string, name: string, range: string, dev = false): string | null {
  const p = parsePkg(text);
  if (!p.ok) return null;
  const key = dev ? 'devDependencies' : 'dependencies';
  const other = dev ? 'dependencies' : 'devDependencies';
  const cur = p.obj[key] && typeof p.obj[key] === 'object' ? { ...p.obj[key] } : {};
  cur[name] = range;
  p.obj[key] = sortedObject(cur);
  if (p.obj[other] && typeof p.obj[other] === 'object' && name in p.obj[other]) {
    const o = { ...p.obj[other] };
    delete o[name];
    p.obj[other] = o;
  }
  return JSON.stringify(p.obj, null, 2) + '\n';
}

export function removeDep(text: string, name: string): { text: string; removed: boolean } | null {
  const p = parsePkg(text);
  if (!p.ok) return null;
  let removed = false;
  for (const key of ['dependencies', 'devDependencies']) {
    const d = p.obj[key];
    if (d && typeof d === 'object' && name in d) {
      const c = { ...d };
      delete c[name];
      p.obj[key] = c;
      removed = true;
    }
  }
  return { text: removed ? JSON.stringify(p.obj, null, 2) + '\n' : text, removed };
}

// نسخة Expo SDK الرئيسية من package.json ("~57.0.1" -> 57)
export function expoMajor(obj: Record<string, any>): number | null {
  const v = obj?.dependencies?.expo ?? obj?.devDependencies?.expo;
  const m = typeof v === 'string' ? v.match(/(\d+)/) : null;
  return m ? Number(m[1]) : null;
}

// تقدير سريع من الاسم بس (للقائمة، قبل ما نجيب بيانات المكتبة)
export function nameRisk(name: string): Risk {
  if (/^(expo-|react-native-|@react-native|@react-native-community\/|@shopify\/react-native)/.test(name)) return 'native';
  return 'unknown';
}

// تقدير أدق من بيانات المكتبة نفسها: peerDependencies على react-native/expo = غالبًا فيها native
export function manifestRisk(m: Record<string, any> | null | undefined): Risk {
  if (!m) return 'unknown';
  const all = { ...(m.dependencies ?? {}), ...(m.peerDependencies ?? {}) } as Record<string, unknown>;
  if ('react-native' in all || 'expo' in all || 'expo-modules-core' in all) return 'native';
  if (m.gypfile === true || (m.scripts && (m.scripts.install || m.scripts.preinstall))) return 'native';
  if (nameRisk(String(m.name ?? '')) === 'native') return 'native';
  return 'js';
}

// المدى المكتوب في package.json لنسخة محلولة: expo-* بتتثبّت بـ ~ (زي expo install)، والباقي ^
export function rangeFor(version: string, sdkTagged: boolean): string {
  return `${sdkTagged ? '~' : '^'}${version}`;
}
