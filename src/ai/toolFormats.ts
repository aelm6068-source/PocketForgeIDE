// src/ai/toolFormats.ts
// تحويل الصيغة الموحّدة (AgentMessage) لطلب كل مزوّد، وتحويل رده لـ StepResult. دوال نقية (من غير شبكة).
// ثلاث صيغ: Anthropic، Gemini، وصيغة OpenAI (بتخدم OpenAI و OpenRouter و Hugging Face).
import type { ProviderId } from './providers';
import type { AgentMessage, StepResult, ToolCall, ToolDef, ToolResult } from './toolTypes';

const MAX_TOKENS = 4096;

function jsonSchema(t: ToolDef): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(t.params)) properties[k] = { type: p.type, description: p.description };
  return { type: 'object', properties, ...(t.required.length ? { required: t.required } : {}) };
}

export interface EncodedRequest {
  url: string;
  body: Record<string, unknown>;
}

export function encodeStep(
  provider: ProviderId,
  model: string,
  system: string,
  messages: AgentMessage[],
  tools: ToolDef[],
): EncodedRequest {
  if (provider === 'anthropic') return encodeAnthropic(model, system, messages, tools);
  if (provider === 'gemini') return encodeGemini(model, system, messages, tools);
  return encodeOpenAi(provider, model, system, messages, tools);
}

export function decodeStep(provider: ProviderId, json: any): StepResult {
  if (provider === 'anthropic') return decodeAnthropic(json);
  if (provider === 'gemini') return decodeGemini(json);
  return decodeOpenAi(provider, json);
}

// معاملات الأداة ممكن توصل كنص JSON أو كائن
function parseArgs(v: unknown): { args: Record<string, unknown>; error?: string } {
  if (v === undefined || v === null || v === '') return { args: {} };
  if (typeof v === 'object' && !Array.isArray(v)) return { args: v as Record<string, unknown> };
  if (typeof v === 'string') {
    try {
      const o = JSON.parse(v);
      if (o && typeof o === 'object' && !Array.isArray(o)) return { args: o as Record<string, unknown> };
      return { args: {}, error: 'not a JSON object' };
    } catch {
      return { args: {}, error: 'not valid JSON' };
    }
  }
  return { args: {}, error: 'unexpected type' };
}

// ---------------- Anthropic ----------------
function anthropicUser(m: Extract<AgentMessage, { role: 'user' }>): any {
  if (!m.images?.length) return { role: 'user', content: m.content };
  return {
    role: 'user',
    content: [
      ...m.images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } })),
      { type: 'text', text: m.content },
    ],
  };
}

function encodeAnthropic(model: string, system: string, messages: AgentMessage[], tools: ToolDef[]): EncodedRequest {
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === 'user') out.push(anthropicUser(m));
    else if (m.role === 'assistant') {
      const blocks: any[] = [];
      if (m.content.trim()) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args });
      if (blocks.length === 0) continue;
      out.push({ role: 'assistant', content: m.toolCalls?.length ? blocks : m.content });
    } else {
      out.push({
        role: 'user',
        content: m.results.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.callId,
          content: r.content,
          ...(r.isError ? { is_error: true } : {}),
        })),
      });
    }
  }
  return {
    url: 'https://api.anthropic.com/v1/messages',
    body: {
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: out,
      ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: jsonSchema(t) })) } : {}),
    },
  };
}

function decodeAnthropic(j: any): StepResult {
  const text: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const b of j?.content ?? []) {
    if (b?.type === 'text' && typeof b.text === 'string') text.push(b.text);
    else if (b?.type === 'tool_use') {
      const p = parseArgs(b.input);
      toolCalls.push({ id: String(b.id), name: String(b.name), args: p.args, ...(p.error ? { argsError: p.error } : {}), native: true });
    }
  }
  return { text: text.join(''), toolCalls };
}

// ---------------- OpenAI-compatible (OpenAI / OpenRouter / Hugging Face) ----------------
function openAiUser(m: Extract<AgentMessage, { role: 'user' }>): any {
  if (!m.images?.length) return { role: 'user', content: m.content };
  return {
    role: 'user',
    content: [
      { type: 'text', text: m.content },
      ...m.images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } })),
    ],
  };
}

function encodeOpenAi(provider: ProviderId, model: string, system: string, messages: AgentMessage[], tools: ToolDef[]): EncodedRequest {
  const out: any[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push(openAiUser(m));
    else if (m.role === 'assistant') {
      if (m.toolCalls?.length) {
        out.push({
          role: 'assistant',
          content: m.content.trim() ? m.content : null,
          tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })),
        });
      } else if (m.content.trim()) out.push({ role: 'assistant', content: m.content });
    } else {
      for (const r of m.results) out.push({ role: 'tool', tool_call_id: r.callId, content: r.content });
    }
  }
  const url =
    provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : provider === 'huggingface'
        ? 'https://router.huggingface.co/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
  return {
    url,
    body: {
      model,
      messages: out,
      ...(tools.length
        ? { tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: jsonSchema(t) } })) }
        : {}),
    },
  };
}

function decodeOpenAi(_provider: ProviderId, j: any): StepResult {
  const msg = j?.choices?.[0]?.message ?? {};
  let text = '';
  if (typeof msg.content === 'string') text = msg.content;
  else if (Array.isArray(msg.content)) text = msg.content.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
  const toolCalls: ToolCall[] = [];
  (Array.isArray(msg.tool_calls) ? msg.tool_calls : []).forEach((c: any, i: number) => {
    const fn = c?.function ?? {};
    if (!fn.name) return;
    const p = parseArgs(fn.arguments);
    const hasId = typeof c.id === 'string' && c.id !== '';
    toolCalls.push({
      id: hasId ? c.id : `call_${i}`,
      name: String(fn.name),
      args: p.args,
      ...(p.error ? { argsError: p.error } : {}),
      native: hasId,
    });
  });
  return { text, toolCalls };
}

// ---------------- Gemini ----------------
function geminiUser(m: Extract<AgentMessage, { role: 'user' }>): any {
  return {
    role: 'user',
    parts: [...(m.images ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } })), { text: m.content }],
  };
}

function geminiResponse(r: ToolResult): any {
  return {
    functionResponse: {
      ...(r.native ? { id: r.callId } : {}),
      name: r.name,
      response: r.isError ? { error: r.content } : { result: r.content },
    },
  };
}

function encodeGemini(model: string, system: string, messages: AgentMessage[], tools: ToolDef[]): EncodedRequest {
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === 'user') contents.push(geminiUser(m));
    else if (m.role === 'assistant') {
      // لو الدور ده جه من Gemini نفسه بنرجّعه كما هو (فيه توقيعات التفكير الي بيطلبها)
      if (m.raw && m.raw.provider === 'gemini' && Array.isArray(m.raw.data) && m.raw.data.length) {
        contents.push({ role: 'model', parts: m.raw.data });
        continue;
      }
      const parts: any[] = [];
      if (m.content.trim()) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.args } });
      if (parts.length) contents.push({ role: 'model', parts });
    } else {
      contents.push({ role: 'user', parts: m.results.map(geminiResponse) });
    }
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      ...(tools.length
        ? { tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: jsonSchema(t) })) }] }
        : {}),
    },
  };
}

function decodeGemini(j: any): StepResult {
  const parts: any[] = Array.isArray(j?.candidates?.[0]?.content?.parts) ? j.candidates[0].content.parts : [];
  const text: string[] = [];
  const toolCalls: ToolCall[] = [];
  parts.forEach((p, i) => {
    if (p?.thought === true) return; // ملخص التفكير مش جزء من الرد
    if (typeof p?.text === 'string') text.push(p.text);
    const fc = p?.functionCall;
    if (fc && fc.name) {
      const a = parseArgs(fc.args);
      const hasId = typeof fc.id === 'string' && fc.id !== '';
      toolCalls.push({ id: hasId ? fc.id : `g${i}`, name: String(fc.name), args: a.args, ...(a.error ? { argsError: a.error } : {}), native: hasId });
    }
  });
  return { text: text.join(''), toolCalls, ...(parts.length ? { raw: { provider: 'gemini' as const, data: parts } } : {}) };
}
