// src/ai/workspace.ts
// منطقة الانتظار: تعديلات الذكاء الاصطناعي بتتخزن هنا (في الذاكرة) ومبتلمسش ملفات المشروع لحد ما
// المستخدم يوافق. الموديل بيشوف تعديلاته أثناء الشغل لأن القراءة بتقرا المنطقة الأول. منطق بحت.
import type { PathEntry } from './projectContext';
import type { ToolContext } from './tools';

export type ChangeKind = 'create' | 'modify' | 'delete';
export interface Change {
  path: string;
  kind: ChangeKind;
  before: string | null; // المحتوى الأصلي (null = الملف مكانش موجود)
  after: string | null; // المحتوى الجديد (null = اتمسح)
}

const NEW_PREFIX = 'new:';

export class Workspace {
  private base = new Map<string, PathEntry>();
  private idToPath = new Map<string, string>();
  private staged = new Map<string, { before: string | null; after: string | null }>();

  private readBase: (id: string) => Promise<string | null>;

  constructor(entries: PathEntry[], readBase: (id: string) => Promise<string | null>) {
    this.readBase = readBase;
    for (const e of entries) {
      this.base.set(e.path, e);
      this.idToPath.set(e.id, e.path);
    }
  }

  // مسارات الملفات الحالية (الأصلية غير المحذوفة + الجديدة)
  paths(): string[] {
    const out = new Set<string>();
    for (const p of this.base.keys()) if (this.staged.get(p)?.after !== null) out.add(p);
    for (const [p, s] of this.staged) if (s.after !== null) out.add(p);
    return [...out].sort();
  }

  // لو المسار موجود بحروف مختلفة (كبيرة/صغيرة) بنرجع المسار الفعلي علشان منعملش ملف مكرر
  resolve(path: string): string {
    const all = this.paths();
    if (all.includes(path)) return path;
    const ci = all.filter((p) => p.toLowerCase() === path.toLowerCase());
    return ci.length === 1 ? ci[0] : path;
  }

  exists(path: string): boolean {
    return this.paths().includes(path);
  }

  isStaged(path: string): boolean {
    return this.staged.has(path);
  }

  stagedCount(): number {
    return this.staged.size;
  }

  async read(path: string): Promise<string | null> {
    const s = this.staged.get(path);
    if (s) return s.after;
    const e = this.base.get(path);
    if (!e) return null;
    return (await this.readBase(e.id)) ?? '';
  }

  private async remember(path: string): Promise<void> {
    if (this.staged.has(path)) return;
    const e = this.base.get(path);
    const before = e ? ((await this.readBase(e.id)) ?? '') : null;
    this.staged.set(path, { before, after: before });
  }

  async write(path: string, content: string): Promise<'created' | 'modified'> {
    const existed = this.exists(path);
    await this.remember(path);
    this.staged.get(path)!.after = content;
    return existed ? 'modified' : 'created';
  }

  async remove(path: string): Promise<void> {
    await this.remember(path);
    this.staged.get(path)!.after = null;
  }

  // الفرق الصافي (من غير الحاجات الي رجعت زي ما كانت)
  changes(): Change[] {
    const out: Change[] = [];
    for (const [path, s] of this.staged) {
      if (s.before === null && s.after === null) continue;
      if (s.before === s.after) continue;
      out.push({ path, kind: s.before === null ? 'create' : s.after === null ? 'delete' : 'modify', before: s.before, after: s.after });
    }
    return out.sort((a, b) => (a.path < b.path ? -1 : 1));
  }

  // سياق أدوات القراءة بنفس شكل tools.ts (بيشوف المنطقة)
  toolContext(): ToolContext {
    const entries: PathEntry[] = this.paths().map((p) => ({ id: this.base.get(p)?.id ?? NEW_PREFIX + p, path: p }));
    return {
      entries,
      read: async (id: string) => {
        const path = id.startsWith(NEW_PREFIX) ? id.slice(NEW_PREFIX.length) : this.idToPath.get(id);
        return path === undefined ? null : this.read(path);
      },
    };
  }
}
