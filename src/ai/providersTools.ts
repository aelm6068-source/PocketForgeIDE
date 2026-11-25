// src/ai/providersTools.ts
// إرسال خطوة واحدة مع أدوات لأي مزوّد: بيبني الطلب (toolFormats) وبيفك الرد. مفيش حلقة هنا.
import { AiError, authHeaders, call, jsonHeaders, type ProviderId } from './providers';
import { decodeStep, encodeStep } from './toolFormats';
import type { AgentMessage, StepResult, ToolDef } from './toolTypes';

export async function sendStep(
  provider: ProviderId,
  key: string,
  model: string,
  system: string,
  messages: AgentMessage[],
  tools: ToolDef[],
): Promise<StepResult> {
  const { url, body } = encodeStep(provider, model, system, messages, tools);
  const json = await call(url, { method: 'POST', headers: { ...jsonHeaders, ...authHeaders(provider, key) }, body: JSON.stringify(body) });
  const r = decodeStep(provider, json);
  if (!r.text.trim() && r.toolCalls.length === 0) throw new AiError('bad_response', 'empty');
  return r;
}
