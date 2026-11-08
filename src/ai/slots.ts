// src/ai/slots.ts
// "الخانة" (slot) = مفتاح + موديل. التطبيق بيشتغل بأكتر من خانة، وكل دور (دردشة/خطة/تنفيذ/صور)
// بيختار خاناته تلقائي أو بترتيب المستخدم. المفتاح نفسه مبيتخزنش هنا (بيتخزن في SecureStore لوحده).
// الملف ده منطق بحت (من غير react) علشان يتختبر.
import type { ProviderId } from './providers';

export type SlotRole = 'chat' | 'plan' | 'agent' | 'vision';
export const SLOT_ROLES: SlotRole[] = ['chat', 'plan', 'agent', 'vision'];
export const MAX_SLOTS = 8;

const PROVIDER_IDS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'openrouter', 'huggingface'];

export interface Slot {
  id: string;
  provider: ProviderId;
  model: string;
  label: string;
  // قدرات الموديل وقت الإضافة (undefined = مش معروف)
  tools?: boolean;
  vision?: boolean;
}

export type RoleRule = { mode: 'auto' } | { mode: 'manual'; order: string[] };
export type RoleRules = Record<SlotRole, RoleRule>;

export function defaultRules(): RoleRules {
  return { chat: { mode: 'auto' }, plan: { mode: 'auto' }, agent: { mode: 'auto' }, vision: { mode: 'auto' } };
}

export function newSlotId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultLabel(provider: ProviderId, model: string): string {
  return `${provider} · ${model}`;
}

// تنضيف اللي اتقرا من التخزين: أي حاجة بايظة بتتشال بدل ما تكسر التطبيق
export function sanitizeSlots(raw: unknown): Slot[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Slot[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id || seen.has(o.id)) continue;
    if (!PROVIDER_IDS.includes(o.provider as ProviderId)) continue;
    if (typeof o.model !== 'string' || !o.model) continue;
    seen.add(o.id);
    const provider = o.provider as ProviderId;
    out.push({
      id: o.id,
      provider,
      model: o.model,
      label: typeof o.label === 'string' && o.label ? o.label : defaultLabel(provider, o.model),
      tools: typeof o.tools === 'boolean' ? o.tools : undefined,
      vision: typeof o.vision === 'boolean' ? o.vision : undefined,
    });
    if (out.length >= MAX_SLOTS) break;
  }
  return out;
}

// تنضيف القواعد: خانات اتمسحت بتتشال من الترتيب اليدوي
export function sanitizeRules(raw: unknown, slots: Slot[]): RoleRules {
  const rules = defaultRules();
  if (!raw || typeof raw !== 'object') return rules;
  const ids = new Set(slots.map((s) => s.id));
  for (const role of SLOT_ROLES) {
    const r = (raw as Record<string, any>)[role];
    if (r && r.mode === 'manual' && Array.isArray(r.order)) {
      const order = r.order.filter((x: unknown, i: number, a: unknown[]) => typeof x === 'string' && ids.has(x) && a.indexOf(x) === i);
      rules[role] = { mode: 'manual', order };
    }
  }
  return rules;
}
