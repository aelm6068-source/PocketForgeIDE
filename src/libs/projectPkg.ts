// src/libs/projectPkg.ts
// إضافة/حذف/عرض مكتبات في package.json بتاع المشروع (عن طريق VirtualFs). بتتشارك بين التاب والطرفية.
import type { VirtualFs } from '../terminal/vfs';
import { addDep, expoMajor, listDeps, parsePkg, parseSpec, removeDep, type DepEntry } from './pkgJson';
import { LibError, resolveLibrary, type FetchFn, type Resolved } from './registry';

const PKG = '/package.json';

async function load(fs: VirtualFs): Promise<{ text: string; obj: Record<string, any> }> {
  await fs.refresh();
  const st = fs.stat(PKG);
  if (!st || st.type !== 'file') throw new LibError('no_package_json');
  const text = await fs.readFile(PKG);
  const p = parsePkg(text);
  if (!p.ok) throw new LibError('bad_package_json');
  return { text, obj: p.obj };
}

export async function listLibraries(fs: VirtualFs): Promise<DepEntry[]> {
  const { obj } = await load(fs);
  return listDeps(obj);
}

export async function addLibrary(fs: VirtualFs, f: FetchFn, spec: string, dev = false): Promise<Resolved> {
  const s = parseSpec(spec);
  if (!s) throw new LibError('invalid_name', spec);
  const { text, obj } = await load(fs);
  const r = await resolveLibrary(f, s.name, s.version, expoMajor(obj));
  const next = addDep(text, r.name, r.range, dev);
  if (next === null) throw new LibError('bad_package_json');
  await fs.writeFile(PKG, next);
  return r;
}

export async function removeLibrary(fs: VirtualFs, name: string): Promise<boolean> {
  const { text } = await load(fs);
  const r = removeDep(text, name);
  if (!r) throw new LibError('bad_package_json');
  if (r.removed) await fs.writeFile(PKG, r.text);
  return r.removed;
}
