// src/ai/chatStore.ts
// حفظ محادثة الذكاء الاصطناعي لكل مشروع لوحده (AsyncStorage). المحادثات منفصلة بالكامل بين المشاريع.
// الصور المرفقة مبتتحفظش (حجمها كبير)، بنحفظ النص بس.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
  via?: string; // اسم الخانة الي ردّت (للرسايل بتاعة الذكاء الاصطناعي)
  mode?: 'plan'; // الرسالة اتبعتت/اترد عليها في وضع الخطة (الدردشة العادية = من غير حقل)
  ctx?: string[]; // مسارات ملفات السياق الي اتبعتت مع الرسالة (للمستخدم بس)
}

const MAX_STORED = 100;
const MAX_CTX = 12;
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
    out.push({
      id,
      role: r.role,
      content: r.content,
      failed: r.failed === true ? true : undefined,
      via: typeof r.via === 'string' && r.via ? r.via : undefined,
      mode: r.mode === 'plan' ? 'plan' : undefined,
      ctx: ctx.length ? ctx : undefined,
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
      .map((m) => ({ id: m.id, role: m.role, content: m.content, failed: m.failed, via: m.via, mode: m.mode, ctx: m.ctx }));
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
