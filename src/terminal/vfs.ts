// نظام الملفات الافتراضي فوق قائمة ProjectFile + مخزن المحتوى

import { FsError } from './types';
import type { FsNode, FsStore } from './types';
import { baseName, joinPath, parentPath, splitPath } from './paths';

const ROOT: FsNode = { id: '__root__', name: '', type: 'folder', parentId: null };
export const MAX_NAME_LENGTH = 100;

export function isValidName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_NAME_LENGTH &&
    name !== '.' &&
    name !== '..' &&
    !/[\/\\]/.test(name)
  );
}

let counter = 0;
const defaultId = (): string =>
  `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface FsEntry {
  name: string;
  type: 'file' | 'folder';
}

export class VirtualFs {
  private nodes: FsNode[] = [];

  constructor(private store: FsStore, private newId: () => string = defaultId) {}

  async refresh(): Promise<void> {
    const loaded = await this.store.loadNodes();
    this.nodes = loaded.map((n) => ({ ...n, parentId: n.parentId ?? null }));
  }

  // ---------- داخلي ----------
  private kids(dir: FsNode): FsNode[] {
    return dir === ROOT
      ? this.nodes.filter((n) => n.parentId === null)
      : this.nodes.filter((n) => n.parentId === dir.id);
  }

  private findChild(dir: FsNode, name: string): FsNode | null {
    const k = this.kids(dir);
    const exact = k.find((n) => n.name === name);
    if (exact) return exact;
    const lower = name.toLowerCase();
    const ci = k.filter((n) => n.name.toLowerCase() === lower);
    return ci.length === 1 ? ci[0] : null;
  }

  private lookup(abs: string): FsNode | null {
    let cur: FsNode = ROOT;
    for (const seg of splitPath(abs)) {
      if (cur.type !== 'folder') return null;
      const next = this.findChild(cur, seg);
      if (!next) return null;
      cur = next;
    }
    return cur;
  }

  private assertNewName(dir: FsNode, name: string, path: string, excludeId?: string): void {
    if (!isValidName(name)) throw new FsError('invalid_name', path);
    const lower = name.toLowerCase();
    if (this.kids(dir).some((n) => n.id !== excludeId && n.name.toLowerCase() === lower)) {
      throw new FsError('exists', path);
    }
  }

  private descendants(node: FsNode): FsNode[] {
    const result: FsNode[] = [];
    const queue = [node];
    while (queue.length) {
      const cur = queue.shift() as FsNode;
      for (const k of this.kids(cur)) {
        result.push(k);
        if (k.type === 'folder') queue.push(k);
      }
    }
    return result;
  }

  private idOf(dir: FsNode): string | null {
    return dir === ROOT ? null : dir.id;
  }

  private folderAt(abs: string): FsNode {
    const dir = this.lookup(abs);
    if (!dir) throw new FsError('not_found', abs);
    if (dir.type !== 'folder') throw new FsError('not_a_dir', abs);
    return dir;
  }

  private async commit(): Promise<void> {
    await this.store.saveNodes(this.nodes);
    this.store.changed?.();
  }

  // ---------- قراءة ----------
  stat(abs: string): { type: 'file' | 'folder'; name: string; isRoot: boolean } | null {
    const n = this.lookup(abs);
    return n ? { type: n.type, name: n.name, isRoot: n === ROOT } : null;
  }

  list(abs: string): FsEntry[] {
    const dir = this.folderAt(abs);
    return this.kids(dir)
      .map((n) => ({ name: n.name, type: n.type }))
      .sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1
      );
  }

  async readFile(abs: string): Promise<string> {
    const n = this.lookup(abs);
    if (!n) throw new FsError('not_found', abs);
    if (n.type === 'folder') throw new FsError('is_a_dir', abs);
    return this.store.readContent(n.id);
  }

  // ---------- كتابة ----------
  async writeFile(abs: string, content: string, append = false): Promise<void> {
    const existing = this.lookup(abs);
    if (existing) {
      if (existing.type === 'folder') throw new FsError('is_a_dir', abs);
      const prev = append ? await this.store.readContent(existing.id) : '';
      await this.store.writeContent(existing.id, prev + content);
      this.store.changed?.();
      return;
    }
    const dir = this.folderAt(parentPath(abs));
    const name = baseName(abs);
    this.assertNewName(dir, name, abs);
    const node: FsNode = { id: this.newId(), name, type: 'file', parentId: this.idOf(dir) };
    await this.store.writeContent(node.id, content);
    this.nodes.push(node);
    await this.commit();
  }

  async mkdir(abs: string, parents = false): Promise<void> {
    const segs = splitPath(abs);
    if (!segs.length) {
      if (parents) return;
      throw new FsError('exists', abs);
    }
    let cur: FsNode = ROOT;
    let curPath = '';
    let created = false;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      curPath += '/' + seg;
      const last = i === segs.length - 1;
      const next = this.findChild(cur, seg);
      if (next) {
        if (next.type !== 'folder') throw new FsError(last ? 'exists' : 'not_a_dir', curPath);
        if (last && !parents) throw new FsError('exists', curPath);
        cur = next;
        continue;
      }
      if (!last && !parents) throw new FsError('not_found', curPath);
      this.assertNewName(cur, seg, curPath);
      const node: FsNode = { id: this.newId(), name: seg, type: 'folder', parentId: this.idOf(cur) };
      this.nodes.push(node);
      created = true;
      cur = node;
    }
    if (created) await this.commit();
  }

  async remove(abs: string, recursive = false): Promise<void> {
    const node = this.lookup(abs);
    if (!node) throw new FsError('not_found', abs);
    if (node === ROOT) throw new FsError('root', abs);
    if (node.type === 'folder' && !recursive) throw new FsError('is_a_dir', abs);
    const all = [node, ...this.descendants(node)];
    const ids = new Set(all.map((n) => n.id));
    for (const n of all) {
      if (n.type === 'file') await this.store.deleteContent(n.id);
    }
    this.nodes = this.nodes.filter((n) => !ids.has(n.id));
    await this.commit();
  }

  async copy(src: string, dst: string, recursive = false): Promise<void> {
    const node = this.lookup(src);
    if (!node) throw new FsError('not_found', src);
    if (node === ROOT) throw new FsError('root', src);
    if (node.type === 'folder' && !recursive) throw new FsError('is_a_dir', src);

    let target = dst;
    const dstNode = this.lookup(dst);
    if (dstNode && dstNode.type === 'folder') target = joinPath(dst, node.name);
    if (node.type === 'folder' && (target === src || target.startsWith(src + '/'))) {
      throw new FsError('invalid_path', target);
    }

    const existing = this.lookup(target);
    if (existing) {
      if (existing.type === 'file' && node.type === 'file') {
        await this.store.writeContent(existing.id, await this.store.readContent(node.id));
        this.store.changed?.();
        return;
      }
      throw new FsError('exists', target);
    }

    const parent = this.folderAt(parentPath(target));
    const name = baseName(target);
    this.assertNewName(parent, name, target);

    const clone = async (from: FsNode, toParent: string | null, toName: string): Promise<void> => {
      const copy: FsNode = { id: this.newId(), name: toName, type: from.type, parentId: toParent };
      if (from.type === 'file') {
        await this.store.writeContent(copy.id, await this.store.readContent(from.id));
        this.nodes.push(copy);
      } else {
        this.nodes.push(copy);
        for (const k of this.kids(from)) {
          if (k.id !== copy.id) await clone(k, copy.id, k.name);
        }
      }
    };
    await clone(node, this.idOf(parent), name);
    await this.commit();
  }

  async move(src: string, dst: string): Promise<void> {
    const node = this.lookup(src);
    if (!node) throw new FsError('not_found', src);
    if (node === ROOT) throw new FsError('root', src);

    let target = dst;
    const dstNode = this.lookup(dst);
    if (dstNode && dstNode.type === 'folder') target = joinPath(dst, node.name);
    if (target === src) return;
    if (node.type === 'folder' && target.startsWith(src + '/')) {
      throw new FsError('invalid_path', target);
    }
    const ex = this.lookup(target);
    if (ex && ex !== node) throw new FsError('exists', target);

    const parent = this.folderAt(parentPath(target));
    const name = baseName(target);
    this.assertNewName(parent, name, target, node.id);
    node.name = name;
    node.parentId = this.idOf(parent);
    await this.commit();
  }
}