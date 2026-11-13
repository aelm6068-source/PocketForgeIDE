// src/ai/useAiSlots.ts
// حالة الخانات في الواجهة: تحميل (مع ترحيل المفاتيح القديمة أول مرة)، إضافة/تعديل/حذف، القواعد،
// وإرسال رسالة عبر الراوتر. فترات الانتظار بعد الأخطاء بتتحفظ في الذاكرة بس (بتتصفّر مع غلق التطبيق).
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendChat, type ChatMessage } from './providers';
import { routedSend, type RouteResult } from './routedSend';
import type { Cooldowns } from './router';
import { slotStore } from './slotStore';
import type { NewSlot, SlotPatch } from './slotStoreCore';
import { defaultRules, type RoleRule, type RoleRules, type Slot, type SlotRole } from './slots';

export function useAiSlots() {
  const [loaded, setLoaded] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [rules, setRules] = useState<RoleRules>(defaultRules());
  const [, setTick] = useState(0); // علشان الواجهة تتحدّث لما فترة انتظار تتسجّل
  const latest = useRef<{ slots: Slot[]; rules: RoleRules }>({ slots: [], rules: defaultRules() });
  const cooldowns = useRef<Cooldowns>({});

  const reload = useCallback(async () => {
    const st = await slotStore.load();
    latest.current = { slots: st.slots, rules: st.rules };
    setSlots(st.slots);
    setRules(st.rules);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    async (input: NewSlot, key: string) => {
      const slot = await slotStore.add(input, key);
      await reload();
      return slot;
    },
    [reload]
  );

  const update = useCallback(
    async (id: string, patch: SlotPatch) => {
      const slot = await slotStore.update(id, patch);
      await reload();
      return slot;
    },
    [reload]
  );

  const reorder = useCallback(
    async (ids: string[]) => {
      await slotStore.reorder(ids);
      await reload();
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      const ok = await slotStore.remove(id);
      delete cooldowns.current[id];
      await reload();
      return ok;
    },
    [reload]
  );

  const setRule = useCallback(
    async (role: SlotRole, rule: RoleRule) => {
      await slotStore.setRule(role, rule);
      await reload();
    },
    [reload]
  );

  const setKey = useCallback(async (id: string, key: string) => {
    const ok = await slotStore.setKey(id, key);
    delete cooldowns.current[id];
    setTick((n) => n + 1);
    return ok;
  }, []);

  // وقت انتهاء انتظار الخانة (ms) أو 0 لو جاهزة
  const busyUntil = useCallback((id: string) => {
    const until = cooldowns.current[id];
    return until !== undefined && until > Date.now() ? until : 0;
  }, []);

  const clearCooldown = useCallback((id: string) => {
    delete cooldowns.current[id];
    setTick((n) => n + 1);
  }, []);

  const route = useCallback(
    async (role: SlotRole, messages: ChatMessage[], system: string): Promise<RouteResult> => {
      try {
        return await routedSend(
          {
            role,
            slots: latest.current.slots,
            rules: latest.current.rules,
            cooldowns: cooldowns.current,
            system,
            messages,
            hasImages: messages.some((m) => !!m.images?.length),
          },
          { send: sendChat, getKey: slotStore.getKey, now: Date.now }
        );
      } finally {
        setTick((n) => n + 1);
      }
    },
    []
  );

  return { loaded, slots, rules, add, update, remove, reorder, setRule, setKey, busyUntil, clearCooldown, route };
}
