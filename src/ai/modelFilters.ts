// src/ai/modelFilters.ts
// فلاتر قايمة الموديلات (دوال نقية). المزوّدين مبيحطوش علامة "للبرمجة" أو "موصى بيه"،
// فالقواعد دي قواعدنا إحنا، وبتتحسب من القايمة نفسها كل مرة (مفيش أسماء موديلات ثابتة تقدم).
import type { ModelInfo, ProviderId } from './providers';

export type ModelView = 'all' | 'coding' | 'recommended';

// موديلات مش للمحادثة النصية (صوت، صور، فيديو، embeddings، روبوتات، بحث عميق...)
const NON_CHAT =
  /(embed|tts|transcribe|whisper|audio|realtime|\blive\b|-live|image|imagen|veo|video|speech|moderation|robotics|computer-use|deep-research|antigravity|aqa|dall-e|rerank|guard|diffusion|flux|sora|lyria|safeguard)/i;

export function isChatModel(m: ModelInfo): boolean {
  return !NON_CHAT.test(m.id);
}

export function isCodingModel(m: ModelInfo): boolean {
  return isChatModel(m) && m.tools !== false;
}

// أرقام الإصدار من الاسم: "gemini-3.8-flash" -> [3,8]. بنتجاهل التواريخ (20250929 / 2025-09-29).
export function versionOf(id: string): number[] {
  const clean = id.replace(/\d{4}-\d{2}-\d{2}/g, '').replace(/\d{6,}/g, '');
  const m = clean.match(/\d+(?:[.-]\d+)*/);
  return m ? m[0].split(/[.-]/).map(Number) : [];
}

function cmpVersion(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

const isPreview = (id: string) => /(preview|exp|beta|alpha)/i.test(id);

// الأحدث: بالتاريخ لو معروف، وإلا بالإصدار، وبالنسخة المستقرة قبل التجريبية عند التعادل
function newest(list: ModelInfo[]): ModelInfo | undefined {
  return [...list].sort((a, b) => {
    if (a.created !== undefined && b.created !== undefined && a.created !== b.created) return b.created - a.created;
    const v = cmpVersion(versionOf(b.id), versionOf(a.id));
    if (v !== 0) return v;
    return Number(isPreview(a.id)) - Number(isPreview(b.id));
  })[0];
}

export interface Recommended {
  model: ModelInfo;
  tag: string; // اسم الفئة (Pro / Flash / Sonnet ...) أو سبب الترشيح
}

const TIERS: Partial<Record<ProviderId, { tag: string; test: (id: string) => boolean }[]>> = {
  gemini: [
    { tag: 'Pro', test: (id) => /(^|-)pro(-|$)/.test(id) && !/lite/.test(id) },
    { tag: 'Flash', test: (id) => /(^|-)flash(-|$)/.test(id) && !/lite/.test(id) },
    { tag: 'Flash-Lite', test: (id) => /flash-lite/.test(id) },
  ],
  anthropic: [
    { tag: 'Opus', test: (id) => /opus/.test(id) },
    { tag: 'Sonnet', test: (id) => /sonnet/.test(id) },
    { tag: 'Haiku', test: (id) => /haiku/.test(id) },
  ],
  openai: [
    { tag: 'GPT', test: (id) => /^gpt-\d+(\.\d+)?$/.test(id) },
    { tag: 'Mini', test: (id) => /^gpt-\d+(\.\d+)?-mini$/.test(id) },
    { tag: 'Codex', test: (id) => /codex/.test(id) && !/mini/.test(id) },
  ],
};

const NO_SNAPSHOT = /\d{4}-\d{2}-\d{2}$/; // نسخ مؤرّخة زي gpt-4o-2024-08-06

const MAX_AGGREGATOR = 10;

export function recommended(provider: ProviderId, models: ModelInfo[]): Recommended[] {
  const pool = models.filter(isCodingModel);
  const tiers = TIERS[provider];
  if (tiers) {
    const out: Recommended[] = [];
    for (const t of tiers) {
      const matches = pool.filter((m) => t.test(m.id) && !NO_SNAPSHOT.test(m.id));
      // اسم بديل ثابت زي gemini-flash-latest أحسن من اسم محدد لأنه مبيقدمش
      const alias = matches.find((m) => /-latest$/.test(m.id));
      const best = alias ?? newest(matches);
      if (best && !out.some((r) => r.model.id === best.id)) out.push({ model: best, tag: t.tag });
    }
    return out;
  }
  // OpenRouter / Hugging Face: وسطاء مفيهمش "شركة"، فبنرتّب: المجاني الأول، بعدين الأكبر سياقًا، بعدين الأحدث
  const ranked = [...pool].sort((a, b) => {
    const f = Number(b.free === true) - Number(a.free === true);
    if (f !== 0) return f;
    const c = (b.ctx ?? 0) - (a.ctx ?? 0);
    if (c !== 0) return c;
    return (b.created ?? 0) - (a.created ?? 0);
  });
  return ranked.slice(0, MAX_AGGREGATOR).map((m) => ({ model: m, tag: m.free ? 'free' : '' }));
}

export function visibleModels(
  provider: ProviderId,
  models: ModelInfo[],
  view: ModelView,
  freeOnly: boolean,
  query: string
): ModelInfo[] {
  let list: ModelInfo[];
  if (view === 'recommended') list = recommended(provider, models).map((r) => r.model);
  else if (view === 'coding') list = models.filter(isCodingModel);
  else list = models;
  if (freeOnly) list = list.filter((m) => m.free === true);
  const q = query.trim().toLowerCase();
  if (q) list = list.filter((m) => m.id.toLowerCase().includes(q) || (m.label ?? '').toLowerCase().includes(q));
  return list;
}

// هل في معلومة "مجاني" عند المزوّد ده؟ (علشان نظهر زرار "مجاني فقط" بس لما يكون ليه معنى)
export function hasFreeInfo(models: ModelInfo[]): boolean {
  return models.some((m) => m.free === true);
}