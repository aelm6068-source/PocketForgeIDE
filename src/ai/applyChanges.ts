// src/ai/applyChanges.ts
// تطبيق التعديلات الي المستخدم وافق عليها على المشروع، مع لقطة للتراجع. بيحمي تعديلات المستخدم:
// لو الملف اتغيّر من وقت الاقتراح بنتخطاه (conflict) بدل ما نكتب فوقه. بيشتغل على أي نظام ملفات بنفس الواجهة.
import { parentPath } from '../terminal/paths';
import type { Change } from './workspace';

export interface FsLike {
  refresh(): Promise<void>;
  stat(abs: string): { type: 'file' | 'folder' } | null;
  readFile(abs: string): Promise<string>;
  writeFile(abs: string, content: string): Promise<void>;
  mkdir(abs: string, parents?: boolean): Promise<void>;
  remove(abs: string, recursive?: boolean): Promise<void>;
}

export interface UndoOp {
  path: string;
  restore: string | null; // المحتوى القديم، أو null = الملف يتمسح (كان جديد)
}
export type FailReason = 'conflict' | 'error';
export interface ApplyResult {
  applied: string[];
  failed: { path: string; reason: FailReason }[];
  undo: UndoOp[];
}

const abs = (p: string): string => '/' + p;

async function current(fs: FsLike, path: string): Promise<string | null> {
  const st = fs.stat(abs(path));
  if (!st) return null;
  if (st.type !== 'file') throw new Error('not a file');
  return fs.readFile(abs(path));
}

async function ensureDir(fs: FsLike, path: string): Promise<void> {
  const dir = parentPath(abs(path));
  if (dir !== '/') await fs.mkdir(dir, true);
}

export async function applyChanges(fs: FsLike, changes: Change[]): Promise<ApplyResult> {
  await fs.refresh();
  const res: ApplyResult = { applied: [], failed: [], undo: [] };
  // الكتابة الأول وبعدها الحذف
  const ordered = [...changes.filter((c) => c.kind !== 'delete'), ...changes.filter((c) => c.kind === 'delete')];
  for (const c of ordered) {
    try {
      const now = await current(fs, c.path);
      if (now !== c.before) {
        res.failed.push({ path: c.path, reason: 'conflict' });
        continue;
      }
      if (c.kind === 'delete') {
        await fs.remove(abs(c.path));
      } else {
        await ensureDir(fs, c.path);
        await fs.writeFile(abs(c.path), c.after ?? '');
      }
      res.undo.push({ path: c.path, restore: c.before });
      res.applied.push(c.path);
    } catch {
      res.failed.push({ path: c.path, reason: 'error' });
    }
  }
  return res;
}

// تراجع (بالعكس). الملفات الي اتغيّرت بعد التطبيق مبنرجّعهاش (بنتخطاها) علشان منضيّعش شغل المستخدم.
export async function undoChanges(fs: FsLike, ops: UndoOp[], applied: Change[]): Promise<{ restored: string[]; skipped: string[] }> {
  await fs.refresh();
  const after = new Map(applied.map((c) => [c.path, c.after]));
  const restored: string[] = [];
  const skipped: string[] = [];
  for (const op of [...ops].reverse()) {
    try {
      const now = await current(fs, op.path);
      if (now !== (after.get(op.path) ?? null)) {
        skipped.push(op.path);
        continue;
      }
      if (op.restore === null) {
        if (now !== null) await fs.remove(abs(op.path));
      } else {
        await ensureDir(fs, op.path);
        await fs.writeFile(abs(op.path), op.restore);
      }
      restored.push(op.path);
    } catch {
      skipped.push(op.path);
    }
  }
  return { restored, skipped };
}
