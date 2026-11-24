// src/ai/planFormat.ts
// شكل الخطة: الموديل بيرد ببلوك ```json فيه {goal, steps, risks, checks}، والتطبيق بيعرضها كبطاقة.
// المحلل متسامح: لو الرد مش بالشكل ده بيرجّع null والواجهة تعرض النص عادي. منطق بحت (من غير react).

export interface PlanStep {
  title: string;
  details: string;
  files: string[];
}
export interface Plan {
  goal: string;
  steps: PlanStep[];
  risks: string[];
  checks: string[];
}

const MAX_STEPS = 30;
const MAX_ITEMS = 20;
const MAX_TEXT = 2000;

// تعليمات بتتضاف لتعليمات النظام في وضع الخطة
export function planInstructions(): string {
  return [
    'PLAN MODE: the user wants a plan, not code. Do not write the implementation.',
    'Reply in the same language as the user. You may add one or two short sentences first, then exactly one fenced ```json block with this shape:',
    '{"goal": string, "steps": [{"title": string, "details": string, "files": [string]}], "risks": [string], "checks": [string]}',
    'Rules: steps are ordered and small; "files" lists project file paths each step touches (only paths from the project file list, or new paths you propose); "risks" are things that could go wrong; "checks" are how the user can verify the result. Use empty arrays when there is nothing to list.',
  ].join('\n');
}

function clip(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '';
}

function list(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = clip(x);
    if (s) out.push(s);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export function sanitizePlan(raw: unknown): Plan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const steps: PlanStep[] = [];
  if (Array.isArray(o.steps)) {
    for (const s of o.steps) {
      if (!s || typeof s !== 'object') continue;
      const r = s as Record<string, unknown>;
      const title = clip(r.title);
      const details = clip(r.details);
      if (!title && !details) continue;
      steps.push({ title: title || details.slice(0, 60), details: title ? details : '', files: list(r.files) });
      if (steps.length >= MAX_STEPS) break;
    }
  }
  if (steps.length === 0) return null;
  return { goal: clip(o.goal), steps, risks: list(o.risks), checks: list(o.checks) };
}

function tryParse(s: string): Plan | null {
  try {
    return sanitizePlan(JSON.parse(s));
  } catch {
    return null;
  }
}

// بيفصل الرد لخطة + نص الكلام الباقي. لو مفيش خطة صالحة: plan = null و text = الرد كله.
export function splitPlanReply(reply: string): { plan: Plan | null; text: string } {
  const fence = /```(?:json)?[ \t]*\r?\n?([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(reply)) !== null) {
    const plan = tryParse(m[1].trim());
    if (plan) {
      const text = (reply.slice(0, m.index) + reply.slice(m.index + m[0].length)).trim();
      return { plan, text };
    }
  }
  // احتياطي: أوسع قوسين {} في الرد
  const a = reply.indexOf('{');
  const b = reply.lastIndexOf('}');
  if (a >= 0 && b > a) {
    const plan = tryParse(reply.slice(a, b + 1));
    if (plan) return { plan, text: (reply.slice(0, a) + reply.slice(b + 1)).trim() };
  }
  return { plan: null, text: reply };
}

export function planToMarkdown(plan: Plan): string {
  const lines: string[] = [];
  if (plan.goal) lines.push(`# ${plan.goal}`, '');
  plan.steps.forEach((s, i) => {
    lines.push(`${i + 1}. **${s.title}**`);
    if (s.details) lines.push(`   ${s.details}`);
    if (s.files.length) lines.push(`   - ${s.files.join(', ')}`);
  });
  if (plan.risks.length) lines.push('', '## Risks', ...plan.risks.map((r) => `- ${r}`));
  if (plan.checks.length) lines.push('', '## Checks', ...plan.checks.map((c) => `- ${c}`));
  return lines.join('\n');
}
