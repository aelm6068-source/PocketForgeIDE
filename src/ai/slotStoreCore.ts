// src/ai/slotStoreCore.ts
// منطق تخزين الخانات (من غير react/expo علشان يتختبر): بيتوصّل بالتخزين الحقيقي من slotStore.ts.
// - بيانات الخانات والقواعد في JSON واحد (كتابة واحدة = مفيش حالة نص-محفوظة)
// - كل مفتاح في سر لوحده (SecureStore بيحدد حجم القيمة)
// - أول مرة بيرحّل مفاتيح النظام القديم (مفتاح لكل مزوّد) لخانات، من غير ما يمسح القديم
// - كل العمليات بتتنفذ واحدة ورا التانية علشان إضافتين سريعين ميضيّعوش بعض
import type { ProviderId } from './providers';
import {
  MAX_SLOTS,
  defaultLabel,
  defaultRules,
  sanitizeRules,
  sanitizeSlots,
  type RoleRule,
  type RoleRules,
  type Slot,
  type SlotRole,
} from './slots';

export const STATE_KEY = 'pocketforge_ai_slots_v1';
export const secretName = (id: string) => `pocketforge_ai_slotkey_${id}`;

export interface LegacyEntry {
  provider: ProviderId;
  key: string;
  model: string;
}
export interface StoreDeps {
  getJson(name: string): Promise<unknown>;
  setJson(name: string, value: unknown): Promise<void>;
  getSecret(name: string): Promise<string>;
  setSecret(name: string, value: string): Promise<void>;
  delSecret(name: string): Promise<void>;
  legacy(): Promise<{ active: ProviderId | null; entries: LegacyEntry[] }>;
  newId(): string;
}

export interface StoreState {
  slots: Slot[];
  rules: RoleRules;
  migrated: boolean;
}
export interface NewSlot {
  provider: ProviderId;
  model: string;
  label?: string;
  tools?: boolean;
  vision?: boolean;
}
export type SlotPatch = Partial<Pick<Slot, 'model' | 'label' | 'tools' | 'vision'>>;

// نظام قديم -> خانات (المزوّد النشط الأول). id ثابت علشان إعادة الترحيل متكررش الخانات.
export function planMigration(legacy: { active: ProviderId | null; entries: LegacyEntry[] }): { slots: Slot[]; secrets: Record<string, string> } {
  const usable = legacy.entries.filter((e) => e.key.trim() && e.model.trim());
  usable.sort((a, b) => Number(b.provider === legacy.active) - Number(a.provider === legacy.active));
  const slots: Slot[] = [];
  const secrets: Record<string, string> = {};
  for (const e of usable.slice(0, MAX_SLOTS)) {
    const id = `legacy_${e.provider}`;
    slots.push({ id, provider: e.provider, model: e.model, label: defaultLabel(e.provider, e.model) });
    secrets[id] = e.key.trim();
  }
  return { slots, secrets };
}

export function createSlotStore(deps: StoreDeps) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  async function read(): Promise<StoreState> {
    const raw = (await deps.getJson(STATE_KEY)) as any;
    const slots = sanitizeSlots(raw?.slots);
    return { slots, rules: sanitizeRules(raw?.rules, slots), migrated: raw?.migrated === true };
  }
  const write = (s: StoreState) => deps.setJson(STATE_KEY, s);

  async function readMigrated(): Promise<StoreState> {
    const st = await read();
    if (st.migrated) return st;
    const plan = planMigration(await deps.legacy());
    const existing = new Set(st.slots.map((s) => s.id));
    const fresh = plan.slots.filter((s) => !existing.has(s.id));
    for (const s of fresh) await deps.setSecret(secretName(s.id), plan.secrets[s.id]);
    const next: StoreState = {
      slots: [...st.slots, ...fresh].slice(0, MAX_SLOTS),
      rules: st.rules,
      migrated: true,
    };
    await write(next);
    return next;
  }

  return {
    load: () => serial(readMigrated),

    add: (input: NewSlot, key: string) =>
      serial(async () => {
        const st = await readMigrated();
        if (st.slots.length >= MAX_SLOTS || !key.trim() || !input.model.trim()) return null;
        const slot: Slot = {
          id: deps.newId(),
          provider: input.provider,
          model: input.model,
          label: input.label?.trim() || defaultLabel(input.provider, input.model),
          tools: input.tools,
          vision: input.vision,
        };
        await deps.setSecret(secretName(slot.id), key.trim());
        try {
          await write({ ...st, slots: [...st.slots, slot] });
        } catch (e) {
          await deps.delSecret(secretName(slot.id)).catch(() => undefined);
          throw e;
        }
        return slot;
      }),

    update: (id: string, patch: SlotPatch) =>
      serial(async () => {
        const st = await readMigrated();
        const i = st.slots.findIndex((s) => s.id === id);
        if (i < 0) return null;
        const label = patch.label !== undefined ? patch.label.trim() : undefined;
        const merged: Slot = {
          ...st.slots[i],
          ...patch,
          label: label || st.slots[i].label,
        };
        const slots = st.slots.map((s, j) => (j === i ? merged : s));
        await write({ ...st, slots });
        return merged;
      }),

        // ترتيب الخانات الجديد (الترتيب ده هو ترتيب الاختيار التلقائي). أي خانة مش مذكورة بتفضل في آخر القايمة.
    reorder: (ids: string[]) =>
      serial(async () => {
        const st = await readMigrated();
        const byId = new Map(st.slots.map((s) => [s.id, s]));
        const first = ids.filter((id, i) => byId.has(id) && ids.indexOf(id) === i);
        const rest = st.slots.map((s) => s.id).filter((id) => !first.includes(id));
        const slots = [...first, ...rest].map((id) => byId.get(id) as Slot);
        await write({ ...st, slots });
        return slots;
      }),
    
    remove: (id: string) =>
      serial(async () => {
        const st = await readMigrated();
        if (!st.slots.some((s) => s.id === id)) return false;
        const slots = st.slots.filter((s) => s.id !== id);
        await write({ ...st, slots, rules: sanitizeRules(st.rules, slots) });
        await deps.delSecret(secretName(id)).catch(() => undefined);
        return true;
      }),

    setRule: (role: SlotRole, rule: RoleRule) =>
      serial(async () => {
        const st = await readMigrated();
        const rules = sanitizeRules({ ...st.rules, [role]: rule }, st.slots);
        await write({ ...st, rules });
        return rules;
      }),

    getKey: (id: string) => deps.getSecret(secretName(id)),

    setKey: (id: string, key: string) =>
      serial(async () => {
        const st = await readMigrated();
        if (!st.slots.some((s) => s.id === id) || !key.trim()) return false;
        await deps.setSecret(secretName(id), key.trim());
        return true;
      }),
  };
}

export { defaultRules };
