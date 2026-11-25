// src/ai/chatStore.ts
// حفظ محادثة الذكاء الاصطناعي لكل مشروع لوحده (AsyncStorage). المحادثات منفصلة بالكامل بين المشاريع.
// الصور المرفقة مبتتحفظش (حجمها كبير)، بنحفظ النص بس.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ToolTrace } from './toolTypes';

export interface StoredMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
  via?: string; // اسم الخانة الي ردّت (للرسايل بتاعة الذكاء الاصطناعي)
  mode?: 'plan'; // الرسالة اتبعتت/اترد عليها في وضع الخطة (الدردشة العادية = من غير حقل)
  ctx?: string[]; // مسارات ملفات السياق الي اتبعتت مع الرسالة (للمستخدم بس)
  tools?: ToolTrace[]; // الأدوات الي الموديل استخدمها قبل الرد (نتايجها مبتتحفظش)
  capped?: boolean; // الحلقة وقفت عند الحد الأقصى للخطوات
}

const MAX_STORED = 100;
const MAX_CTX = 12;
const MAX_TOOLS = 20;

function sanitizeTools(v: unknown): ToolTrace[] {
  if (!Array.isArray(v)) return [];
  const out: ToolTrace[] = [];
  for (const t of v) {
    if (!t || typeof t !== 'object') continue;
    const r = t as Record<string, unknown>;
    if (typeof r.name !== 'string' || !r.name) continue;
    out.push({ name: r.name.slice(0, 40), arg: typeof r.arg === 'string' ? r.arg.slice(0, 120) : '', ok: r.ok !== false });
    if (out.length >= MAX_TOOLS) break;
  }
  return out;
}
const keyFor = (projectId: string) => `pocketforge_ai_chat_${projectId}`;

export function sanitizeStored(raw: unknown): StoredMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const r = m as Record<string, unknown>;
    if ((r.role !== 'user' && r.role !== 'assistant') || typeof r.content !== 'string') continue;
    const id = typeof r.id === 'number' ? r.id : out.length + 1;
    const ctx = Array.isArray(r.ctx)
      ? r.ctx.filter((x): x is string => typeof x === 'string' && !!x).slice(0, MAX_CTX)
      : [];
    const tools = sanitizeTools(r.tools);
    out.push({
      id,
      role: r.role,
      content: r.content,
      failed: r.failed === true ? true : undefined,
      via: typeof r.via === 'string' && r.via ? r.via : undefined,
      mode: r.mode === 'plan' ? 'plan' : undefined,
      ctx: ctx.length ? ctx : undefined,
      tools: tools.length ? tools : undefined,
      capped: r.capped === true ? true : undefined,
    });
  }
  return out.slice(-MAX_STORED);
}

export async function loadChat(projectId: string): Promise<StoredMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(projectId));
    return raw ? sanitizeStored(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export async function saveChat(projectId: string, messages: StoredMessage[]): Promise<void> {
  try {
    const slim = messages
      .slice(-MAX_STORED)
      .map((m) => ({ id: m.id, role: m.role, content: m.content, failed: m.failed, via: m.via, mode: m.mode, ctx: m.ctx, tools: m.tools, capped: m.capped }));
    await AsyncStorage.setItem(keyFor(projectId), JSON.stringify(slim));
  } catch (err) {
    console.warn('AI: failed to save chat', err);
  }
}

export async function clearChat(projectId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(projectId));
  } catch (err) {
    console.warn('AI: failed to clear chat', err);
  }
}
