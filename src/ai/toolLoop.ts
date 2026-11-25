// src/ai/toolLoop.ts
// حلقة الأدوات: بتسأل الموديل، لو طلب أدوات بتنفّذها وبترجّع النتايج، وتكرر لحد ما يرد بنص أو يوصل للحد.
// الخطوة والتنفيذ بيتحقنوا (بدون شبكة/react) علشان تتختبر.
import type { Slot } from './slots';
import { toolArgSummary } from './tools';
import type { AgentMessage, StepResult, ToolCall, ToolResult, ToolTrace } from './toolTypes';

export const DEFAULT_MAX_STEPS = 10;

export interface LoopDeps {
  step: (messages: AgentMessage[]) => Promise<{ step: StepResult; slot: Slot }>;
  execute: (call: ToolCall) => Promise<ToolResult>;
  onTool?: (call: ToolCall, result: ToolResult) => void;
}

export interface LoopResult {
  text: string;
  trace: ToolTrace[];
  slot: Slot | null;
  steps: number;
  capped: boolean;
}

export async function runToolLoop(initial: AgentMessage[], deps: LoopDeps, maxSteps = DEFAULT_MAX_STEPS): Promise<LoopResult> {
  const messages = [...initial];
  const trace: ToolTrace[] = [];
  let slot: Slot | null = null;
  let lastText = '';

  for (let i = 1; i <= maxSteps; i++) {
    const r = await deps.step(messages);
    slot = r.slot;
    const { text, toolCalls, raw } = r.step;
    if (text.trim()) lastText = text;
    if (toolCalls.length === 0) return { text, trace, slot, steps: i, capped: false };

    messages.push({ role: 'assistant', content: text, toolCalls, ...(raw ? { raw } : {}) });
    const results: ToolResult[] = [];
    for (const c of toolCalls) {
      let res: ToolResult;
      try {
        res = await deps.execute(c);
      } catch (e) {
        res = { callId: c.id, name: c.name, native: c.native, isError: true, content: String((e as Error)?.message || e) };
      }
      results.push(res);
      trace.push({ name: c.name, arg: toolArgSummary(c), ok: !res.isError });
      deps.onTool?.(c, res);
    }
    messages.push({ role: 'tool', results });
  }
  return { text: lastText, trace, slot, steps: maxSteps, capped: true };
}
