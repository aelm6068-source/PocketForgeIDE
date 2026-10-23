// src/github/applyRemote.ts
// بيطبّق ملفات نازلة من GitHub على ملفات المشروع (قايمة العُقد + محتوى كل ملف):
// بينشئ المجلدات الناقصة، وبيكتب الملفات، وبيحذف الملفات المحذوفة (وبينضّف المجلدات
// اللي فضيت بسبب الحذف). منطق صرف: التخزين بييجي من برّه.
import type { FsNode } from '../terminal/types';
import type { PullSkip } from './pullPlan';

export interface ApplyStore {
  writeContent(id: string, content: string): Promise<void>;
  deleteContent(id: string): Promise<void>;
}

export interface ApplyResult {
  nodes: FsNode[];
  failed: PullSkip[];
  writtenCount: number;
  deletedCount: number;
}

let counter = 0;
const defaultId = (): string =>
  `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function applyRemote(
  nodes: FsNode[],
  writes: { path: string; content: string }[],
  deletes: string[],
  store: ApplyStore,
  newId: () => string = defaultId
): Promise<ApplyResult> {
  const list = nodes.map((n) => ({ ...n }));
  const failed: PullSkip[] = [];
  let writtenCount = 0;
  let deletedCount = 0;

  const child = (parentId: string | null, name: string) =>
    list.find((n) => n.parentId === parentId && n.name === name);

  // بيرجّع id المجلد الأب للمسار، وبينشئ اللي ناقص. null + failed لو في تعارض نوع.
  const ensureDir = (segments: string[]): { ok: true; id: string | null } | { ok: false } => {
    let parent: string | null = null;
    for (const seg of segments) {
      const found = child(parent, seg);
      if (found) {
        if (found.type !== 'folder') return { ok: false };
        parent = found.id;
      } else {
        const node: FsNode = { id: newId(), name: seg, type: 'folder', parentId: parent };
        list.push(node);
        parent = node.id;
      }
    }
    return { ok: true, id: parent };
  };

  for (const w of writes) {
    const segs = w.path.split('/').filter(Boolean);
    const name = segs[segs.length - 1];
    if (!name) {
      failed.push({ path: w.path, reason: 'path_conflict' });
      continue;
    }
    const dir = ensureDir(segs.slice(0, -1));
    if (!dir.ok) {
      failed.push({ path: w.path, reason: 'path_conflict' });
      continue;
    }
    const existing = child(dir.id, name);
    if (existing && existing.type !== 'file') {
      failed.push({ path: w.path, reason: 'path_conflict' });
      continue;
    }
    const node = existing ?? { id: newId(), name, type: 'file' as const, parentId: dir.id };
    if (!existing) list.push(node);
    await store.writeContent(node.id, w.content);
    writtenCount += 1;
  }

  const touchedDirs = new Set<string>();
  for (const p of deletes) {
    const segs = p.split('/').filter(Boolean);
    let parent: string | null = null;
    let node: FsNode | undefined;
    for (let i = 0; i < segs.length; i++) {
      node = child(parent, segs[i]);
      if (!node) break;
      if (i < segs.length - 1) {
        if (node.type !== 'folder') {
          node = undefined;
          break;
        }
        parent = node.id;
      }
    }
    if (!node || node.type !== 'file') continue;
    await store.deleteContent(node.id);
    list.splice(list.indexOf(node), 1);
    deletedCount += 1;
    if (node.parentId) touchedDirs.add(node.parentId);
  }

  // مجلد فضي بسبب الحذف بيتشال (git مبيحفظش مجلدات فاضية)، وبنطلع لفوق طول ما بيفضى
  for (const start of touchedDirs) {
    let cur: string | null = start;
    while (cur) {
      const id: string = cur;
      if (list.some((n) => n.parentId === id)) break;
      const dirNode = list.find((n) => n.id === id);
      if (!dirNode) break;
      list.splice(list.indexOf(dirNode), 1);
      cur = dirNode.parentId;
    }
  }

  return { nodes: list, failed, writtenCount, deletedCount };
}