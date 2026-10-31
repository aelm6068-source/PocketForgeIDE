// src/ai/providers.ts
// تعريف مزوّدي الذكاء الاصطناعي + الاتصال بيهم (قائمة الموديلات، اختبار المفتاح، إرسال رسالة).
// المفتاح بيروح للمزوّد بس (من الجهاز مباشرة) ومبيتبعتش لأي مكان تاني.
// قائمة الموديلات بتتجاب من المزوّد نفسه، فمفيش أسماء موديلات ثابتة تقدم.

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'huggingface';
export type ChatRole = 'user' | 'assistant';
// صورة مرفقة: base64 من غير البادئة "data:" + نوعها (image/jpeg مثلًا)
export interface ChatImage {
  mime: string;
  data: string;
}
export interface ChatMessage {
  role: ChatRole;
  content: string;
  images?: ChatImage[];
}

export type AiErrorCode = 'auth' | 'rate' | 'network' | 'http' | 'bad_response' | 'no_model';
export class AiError extends Error {
  code: AiErrorCode;
  status?: number;
  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
  }
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  keyUrl: string; // صفحة بيجيب منها المستخدم مفتاحه
  free: boolean; // فيه طبقة مجانية معروفة
  hintKey?: string; // مفتاح نص تنبيه يظهر تحت خانة المفتاح (في src/i18n/ai.ts)
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'gemini', name: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey', free: true },
  { id: 'openrouter', name: 'OpenRouter', keyUrl: 'https://openrouter.ai/keys', free: true },
  { id: 'huggingface', name: 'Hugging Face', keyUrl: 'https://huggingface.co/settings/tokens/new?tokenType=fineGrained', free: true, hintKey: 'ai_hint_huggingface' },
  { id: 'anthropic', name: 'Anthropic (Claude)', keyUrl: 'https://console.anthropic.com/settings/keys', free: false },
  { id: 'openai', name: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', free: false },
];

const TIMEOUT_MS = 90000;

async function call(url: string, init: RequestInit): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    throw new AiError('network', String(e?.message || e));
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const detail = String(json?.error?.message || json?.error || json?.message || text || '').slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new AiError('auth', detail, res.status);
    if (res.status === 429) throw new AiError('rate', detail, res.status);
    throw new AiError('http', detail, res.status);
  }
  if (json === null) throw new AiError('bad_response', text.slice(0, 200));
  return json;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

function authHeaders(provider: ProviderId, key: string): Record<string, string> {
  if (provider === 'anthropic') return { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (provider === 'gemini') return { 'x-goog-api-key': key };
  return { Authorization: `Bearer ${key}` };
}

// قائمة الموديلات المتاحة للمفتاح ده. بتستخدم كمان كاختبار للمفتاح.
export async function listModels(provider: ProviderId, key: string): Promise<string[]> {
  const headers = authHeaders(provider, key);
  let ids: string[] = [];
  if (provider === 'anthropic') {
    const j = await call('https://api.anthropic.com/v1/models?limit=100', { headers });
    ids = (j?.data ?? []).map((m: any) => String(m.id));
  } else if (provider === 'gemini') {
    const j = await call('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers });
    ids = (j?.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''));
  } else if (provider === 'openai') {
    const j = await call('https://api.openai.com/v1/models', { headers });
    ids = (j?.data ?? []).map((m: any) => String(m.id)).filter((id: string) => /^(gpt|o\d|chatgpt)/.test(id));
  } else if (provider === 'huggingface') {
    const j = await call('https://router.huggingface.co/v1/models', { headers });
    ids = (j?.data ?? []).map((m: any) => String(m.id));
  } else {
    const j = await call('https://openrouter.ai/api/v1/models', { headers });
    ids = (j?.data ?? []).map((m: any) => String(m.id));
  }
  return Array.from(new Set(ids)).sort();
}

function textOf(parts: any[] | undefined, field: string): string {
  return (parts ?? []).map((p) => (typeof p?.[field] === 'string' ? p[field] : '')).join('');
}

// بيبعت المحادثة كلها ويرجّع نص الرد. system = تعليمات عامة (اسم المشروع وملفاته مثلًا).
export async function sendChat(
  provider: ProviderId,
  key: string,
  model: string,
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  if (!model) throw new AiError('no_model', '');
  const headers = { ...jsonHeaders, ...authHeaders(provider, key) };

  if (provider === 'anthropic') {
    const j = await call('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, max_tokens: 4096, system, messages: messages.map(anthropicMessage) }),
    });
    const out = (j?.content ?? []).filter((b: any) => b?.type === 'text');
    return finish(textOf(out, 'text'));
  }

  if (provider === 'gemini') {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [
          ...(m.images ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } })),
          { text: m.content },
        ],
      })),
    };
    const j = await call(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { method: 'POST', headers, body: JSON.stringify(body) },
    );
    return finish(textOf(j?.candidates?.[0]?.content?.parts, 'text'));
  }

  const url =
    provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : provider === 'huggingface'
        ? 'https://router.huggingface.co/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
  const j = await call(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages.map(openAiMessage)] }),
  });
  const c = j?.choices?.[0]?.message?.content;
  return finish(typeof c === 'string' ? c : '');
}

// صيغة الرسالة مع الصور عند Claude
function anthropicMessage(m: ChatMessage): any {
  if (!m.images?.length) return { role: m.role, content: m.content };
  return {
    role: m.role,
    content: [
      ...m.images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } })),
      { type: 'text', text: m.content },
    ],
  };
}

// صيغة الرسالة مع الصور عند OpenAI / OpenRouter / Hugging Face (كلهم بنفس الصيغة)
function openAiMessage(m: ChatMessage): any {
  if (!m.images?.length) return { role: m.role, content: m.content };
  return {
    role: m.role,
    content: [
      { type: 'text', text: m.content },
      ...m.images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } })),
    ],
  };
}

function finish(text: string): string {
  if (!text.trim()) throw new AiError('bad_response', 'empty');
  return text;
}