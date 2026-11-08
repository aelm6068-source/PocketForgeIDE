// src/ai/router.ts
// قواعد اختيار الخانة (دوال نقية، من غير شبكة ولا react):
// الدور محتاج إيه -> ترتيب المستخدم -> نتخطى الخانات الواصلة للحد -> الباقي بالترتيب.
// مفيش تخمين: نفس المدخلات بتدي نفس النتيجة.
import type { AiErrorCode } from './providers';
import type { RoleRules, Slot, SlotRole } from './slots';

export type Cooldowns = Record<string, number>; // slotId -> وقت الانتهاء (ms)

export interface Need {
  tools?: boolean;
  vision?: boolean;
}

// كل دور محتاج إيه من الموديل
export function needFor(role: SlotRole, hasImages = false): Need {
  const need: Need = {};
  if (role === 'agent') need.tools = true;
  if (role === 'vision' || hasImages) need.vision = true;
  return need;
}

// الخانة صالحة لو القدرة المطلوبة مش معروفة إنها مش موجودة (false بس هي الي بتستبعد)
export function isEligible(slot: Slot, need: Need): boolean {
  if (need.tools && slot.tools === false) return false;
  if (need.vision && slot.vision === false) return false;
  return true;
}

// القدرة مؤكدة (true) بتتقدم على الي مش معروفة
function confirmed(slot: Slot, need: Need): number {
  let n = 0;
  if (need.tools && slot.tools === true) n++;
  if (need.vision && slot.vision === true) n++;
  return n;
}

export interface Pick {
  candidates: Slot[]; // جاهزة بالترتيب
  busy: { slot: Slot; until: number }[]; // صالحة بس في فترة انتظار
  reason?: 'no_slots' | 'no_capable' | 'all_busy';
  retryInMs?: number; // لو all_busy: أقرب انتظار
}

export function pickSlots(
  role: SlotRole,
  slots: Slot[],
  rules: RoleRules,
  cooldowns: Cooldowns,
  now: number,
  hasImages = false,
): Pick {
  if (slots.length === 0) return { candidates: [], busy: [], reason: 'no_slots' };
  const need = needFor(role, hasImages);
  const rule = rules[role];

  let ordered: Slot[];
  if (rule && rule.mode === 'manual') {
    const byId = new Map(slots.map((s) => [s.id, s]));
    ordered = rule.order.map((id) => byId.get(id)).filter((s): s is Slot => !!s);
  } else {
    // تلقائي: بترتيب الخانات، والي قدرتها مؤكدة الأول (الترتيب ثابت عند التعادل)
    ordered = slots
      .map((s, i) => ({ s, i }))
      .sort((a, b) => confirmed(b.s, need) - confirmed(a.s, need) || a.i - b.i)
      .map((x) => x.s);
  }

  const capable = ordered.filter((s) => isEligible(s, need));
  if (capable.length === 0) return { candidates: [], busy: [], reason: 'no_capable' };

  const candidates: Slot[] = [];
  const busy: { slot: Slot; until: number }[] = [];
  for (const s of capable) {
    const until = cooldowns[s.id];
    if (until !== undefined && until > now) busy.push({ slot: s, until });
    else candidates.push(s);
  }
  if (candidates.length === 0) {
    const soonest = Math.min(...busy.map((b) => b.until));
    return { candidates, busy, reason: 'all_busy', retryInMs: Math.max(0, soonest - now) };
  }
  return { candidates, busy };
}

const MINUTE = 60 * 1000;

// "retry in 12.5s" / "retryDelay": "12s" / "try again in 2 minutes" من رسالة المزوّد
export function parseRetryMs(message: string): number | undefined {
  const m =
    message.match(/retry(?:\s*delay)?\W{0,6}(?:in\s*)?(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds?|m|min|minutes?)\b/i) ||
    message.match(/try again in\s*(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds?|m|min|minutes?)\b/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  const ms = u === 'ms' ? n : u.startsWith('m') ? n * MINUTE : n * 1000;
  return Math.min(Math.ceil(ms), 10 * MINUTE);
}

// بعد فشل خانة: تتجرب خانة تانية؟ (no_model معناها مفيش موديل مختار، التبديل مش هيحلها)
export function shouldFailover(code: AiErrorCode): boolean {
  return code !== 'no_model';
}

// الخانة تستنى قد إيه بعد الخطأ ده (ms). undefined = مفيش انتظار (الخانة نفسها سليمة)
export function cooldownMs(code: AiErrorCode, message: string, status?: number): number | undefined {
  switch (code) {
    case 'rate':
      if (/limit:\s*0\b/i.test(message)) return 60 * MINUTE; // مش متاح لخطة المفتاح ده
      return parseRetryMs(message) ?? MINUTE;
    case 'auth':
      return 60 * MINUTE; // المفتاح محتاج المستخدم يصلحه
    case 'timeout':
    case 'network':
      return 15 * 1000;
    case 'http':
      return status !== undefined && status >= 500 ? 30 * 1000 : undefined;
    default:
      return undefined;
  }
}
