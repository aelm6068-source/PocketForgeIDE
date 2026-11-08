// src/ai/routedSend.ts
// إرسال رسالة عبر الراوتر: يختار الخانات المناسبة للدور، ولو خانة فشلت (حد طلبات/مهلة/شبكة/مفتاح)
// يسجّل لها فترة انتظار ويجرّب الخانة التالية تلقائي. بدون react، والإرسال نفسه بيتحقن علشان يتختبر.
import { AiError, type ChatMessage } from './providers';
import { cooldownMs, pickSlots, shouldFailover, type Cooldowns } from './router';
import type { RoleRules, Slot, SlotRole } from './slots';

export type SendFn = (provider: Slot['provider'], key: string, model: string, system: string, messages: ChatMessage[]) => Promise<string>;

export interface RouteDeps {
  send: SendFn;
  getKey: (slotId: string) => Promise<string>;
  now: () => number;
}

export interface RouteRequest {
  role: SlotRole;
  slots: Slot[];
  rules: RoleRules;
  cooldowns: Cooldowns; // بيتعدّل جوه (الانتظار بعد الأخطاء)
  system: string;
  messages: ChatMessage[];
  hasImages: boolean;
}

export interface RouteResult {
  reply: string;
  slot: Slot;
  failedOver: number; // كام خانة اتجربت وفشلت قبل النجاح
}

// مفيش خانة تنفع أو كلها مشغولة (غير خطأ المزوّد نفسه)
export type RouteFailReason = 'no_slots' | 'no_capable' | 'all_busy';
export class RouteError extends Error {
  reason: RouteFailReason;
  retryInMs?: number;
  constructor(reason: RouteFailReason, retryInMs?: number) {
    super(reason);
    this.name = 'RouteError';
    this.reason = reason;
    this.retryInMs = retryInMs;
  }
}

export async function routedSend(req: RouteRequest, deps: RouteDeps): Promise<RouteResult> {
  const pick = pickSlots(req.role, req.slots, req.rules, req.cooldowns, deps.now(), req.hasImages);
  if (pick.candidates.length === 0) throw new RouteError(pick.reason ?? 'no_slots', pick.retryInMs);

  let lastError: unknown = null;
  let failedOver = 0;
  for (const slot of pick.candidates) {
    try {
      const key = await deps.getKey(slot.id);
      if (!key) throw new AiError('auth', '');
      const reply = await deps.send(slot.provider, key, slot.model, req.system, req.messages);
      return { reply, slot, failedOver };
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      const wait = cooldownMs(e.code, e.message, e.status);
      if (wait !== undefined) req.cooldowns[slot.id] = deps.now() + wait;
      lastError = e;
      if (!shouldFailover(e.code)) throw e;
      failedOver++;
    }
  }
  throw lastError;
}
