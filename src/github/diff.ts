// src/github/diff.ts
// مقارنة ملفات المشروع الحالية بآخر نسخة اترفعت (link.files: المسار -> blob sha):
// جديد / معدّل / محذوف. بنحسب blob sha لكل ملف محليًا بنفس طريقة git.
import { gitBlobSha } from './gitSha';
import type { SnapshotEntry } from './snapshot';

export interface HashedEntry extends SnapshotEntry {
  sha: string;
}

export interface ChangeSet {
  added: HashedEntry[];
  modified: HashedEntry[];
  deleted: string[];
  unchangedCount: number;
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// بنحسب الـ sha ملف ملف، ونسيب الواجهة تتنفس بين كل ملف وملف
export async function hashEntries(entries: SnapshotEntry[]): Promise<HashedEntry[]> {
  const out: HashedEntry[] = [];
  for (const e of entries) {
    out.push({ ...e, sha: gitBlobSha(e.content, e.encoding) });
    await yieldToUi();
  }
  return out;
}

export function diffEntries(entries: HashedEntry[], base: Record<string, string>): ChangeSet {
  const added: HashedEntry[] = [];
  const modified: HashedEntry[] = [];
  let unchangedCount = 0;
  const present = new Set<string>();
  for (const e of entries) {
    present.add(e.path);
    const old = base[e.path];
    if (old === undefined) added.push(e);
    else if (old !== e.sha) modified.push(e);
    else unchangedCount += 1;
  }
  const deleted = Object.keys(base)
    .filter((p) => !present.has(p))
    .sort();
  return { added, modified, deleted, unchangedCount };
}

export function countChanges(c: ChangeSet): number {
  return c.added.length + c.modified.length + c.deleted.length;
}