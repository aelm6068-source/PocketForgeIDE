// src/ai/chatRequest.ts
// تجهيز طلب الدردشة/الخطة: الدور، تعليمات النظام، والرسايل المتبعتة. ملفات السياق بتتضاف
// لرسالة المستخدم الحالية بس (مش للتاريخ). منطق بحت (من غير react).
import type { ChatImage, ChatMessage } from './providers';
import type { SlotRole } from './slots';
import { planInstructions } from './planFormat';

export type ChatMode = 'chat' | 'plan' | 'agent';
export const MAX_HISTORY = 30; // آخر 30 رسالة بس بتتبعت للمزوّد

export interface PrepareArgs {
  history: ChatMessage[]; // الرسايل السابقة (من غير الحالية ومن غير الفاشلة)
  text: string;
  images?: ChatImage[];
  mode: ChatMode;
  contextText: string;
  system: string;
}
export interface PreparedRequest {
  role: SlotRole;
  system: string;
  payload: ChatMessage[];
}

export function prepareRequest(a: PrepareArgs): PreparedRequest {
  const current: ChatMessage = {
    role: 'user',
    content: a.contextText ? `${a.contextText}\n\n${a.text}` : a.text,
    images: a.images,
  };
  const payload = [...a.history.slice(-(MAX_HISTORY - 1)), current];
  // أول رسالة لازم تبقى من المستخدم (شرط بعض المزوّدين)
  while (payload.length && payload[0].role !== 'user') payload.shift();
  return {
    role: a.mode === 'plan' ? 'plan' : a.mode === 'agent' ? 'agent' : 'chat',
    system: a.mode === 'plan' ? `${a.system}\n\n${planInstructions()}` : a.system,
    payload,
  };
}
