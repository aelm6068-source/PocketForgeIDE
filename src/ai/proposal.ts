// src/ai/proposal.ts
// ملخص التعديلات المقترحة (الي بيتخزن مع الرسالة وبيتعرض في كارت المراجعة). مفيهوش محتوى الملفات.
import { countChanges } from './lineDiff';
import type { Change, ChangeKind } from './workspace';

export type ProposalStatus = 'pending' | 'applied' | 'rejected' | 'undone' | 'expired';
export type ItemResult = 'applied' | 'conflict' | 'error' | 'skipped' | 'undone' | 'undo_skipped';

export interface ProposalItem {
  path: string;
  kind: ChangeKind;
  add: number;
  del: number;
  result?: ItemResult;
}
export interface Proposal {
  status: ProposalStatus;
  items: ProposalItem[];
}

const MAX_ITEMS = 20;
const KINDS: ChangeKind[] = ['create', 'modify', 'delete'];
const STATUSES: ProposalStatus[] = ['pending', 'applied', 'rejected', 'undone', 'expired'];
const RESULTS: ItemResult[] = ['applied', 'conflict', 'error', 'skipped', 'undone', 'undo_skipped'];

export function makeProposal(changes: Change[]): Proposal {
  return {
    status: 'pending',
    items: changes.slice(0, MAX_ITEMS).map((c) => ({ path: c.path, kind: c.kind, ...countChanges(c.before, c.after) })),
  };
}

// تنظيف من التخزين. "pending" بعد إعادة تشغيل التطبيق = expired (المحتوى كان في الذاكرة بس).
export function sanitizeProposal(raw: unknown): Proposal | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items)) return undefined;
  const items: ProposalItem[] = [];
  for (const it of r.items) {
    if (!it || typeof it !== 'object') continue;
    const x = it as Record<string, unknown>;
    if (typeof x.path !== 'string' || !x.path || !KINDS.includes(x.kind as ChangeKind)) continue;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    items.push({
      path: x.path.slice(0, 200),
      kind: x.kind as ChangeKind,
      add: num(x.add),
      del: num(x.del),
      result: RESULTS.includes(x.result as ItemResult) ? (x.result as ItemResult) : undefined,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  if (!items.length) return undefined;
  const status = STATUSES.includes(r.status as ProposalStatus) ? (r.status as ProposalStatus) : 'expired';
  return { status: status === 'pending' ? 'expired' : status, items };
}
