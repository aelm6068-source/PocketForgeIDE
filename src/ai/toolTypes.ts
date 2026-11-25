// src/ai/toolTypes.ts
// الصيغة الموحّدة لرسايل الأدوات (نفس الصيغة لكل المزوّدين). كل مزوّد ليه محوّل في toolFormats.ts.
// أنواع فقط، من غير منطق، علشان تتشارك بين الراوتر والحلقة والمحوّلات والواجهة.
import type { ChatImage, ProviderId } from './providers';

// أداة: معاملات مسطّحة (نص/رقم/منطقي) علشان تنفع مع كل المزوّدين (Gemini مثلًا مبيقبلش كل مفاتيح JSON Schema)
export interface ToolParam {
  type: 'string' | 'number' | 'boolean';
  description: string;
}
export interface ToolDef {
  name: string;
  description: string;
  params: Record<string, ToolParam>;
  required: string[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  argsError?: string; // المزوّد بعت معاملات مش JSON صالح
  native?: boolean; // المعرّف جاي من المزوّد نفسه (Gemini ساعات مبيبعتش معرّف)
}

export interface ToolResult {
  callId: string;
  name: string;
  content: string;
  isError?: boolean;
  native?: boolean;
}

// دور الموديل زي ما رجع من المزوّد بالظبط (Gemini 3 بيطلب نرجّع أجزاء الرد كما هي، بتوقيعات التفكير)
export interface RawTurn {
  provider: ProviderId;
  data: unknown;
}

export type AgentMessage =
  | { role: 'user'; content: string; images?: ChatImage[] }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[]; raw?: RawTurn }
  | { role: 'tool'; results: ToolResult[] };

// نتيجة خطوة واحدة من الموديل: نص و/أو طلبات أدوات
export interface StepResult {
  text: string;
  toolCalls: ToolCall[];
  raw?: RawTurn;
}

// سطر في سجل الأدوات الي بيتعرض للمستخدم
export interface ToolTrace {
  name: string;
  arg: string;
  ok: boolean;
}
