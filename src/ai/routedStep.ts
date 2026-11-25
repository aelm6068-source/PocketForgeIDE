// src/ai/routedStep.ts
// نفس routedSend لكن لخطوة فيها أدوات (StepResult). الخانات لازم تكون بتدعم الأدوات (forceTools).
import { AiError } from './providers';
import { cooldownMs, pickSlots, shouldFailover, type Cooldowns } from './router';
import { RouteError } from './routedSend';
import type { RoleRules, Slot, SlotRole } from './slots';
import type { AgentMessage, StepResult, ToolDef } from './toolTypes';

export type StepFn = (
  provider: Slot['provider'],
  key: string,
  model: string,
  system: string,
  messages: AgentMessage[],
  tools: ToolDef[],
) => Promise<StepResult>;

export interface StepDeps {
  send: StepFn;
  getKey: (slotId: string) => Promise<string>;
  now: () => number;
}

export interface StepRequest {
  role: SlotRole;
  slots: Slot[];
  rules: RoleRules;
  cooldowns: Cooldowns;
  system: string;
  messages: AgentMessage[];
  tools: ToolDef[];
  hasImages: boolean;
}

export interface StepRouteResult {
  step: StepResult;
  slot: Slot;
  failedOver: number;
}

export async function routedStep(req: StepRequest, deps: StepDeps): Promise<StepRouteResult> {
  const pick = pickSlots(req.role, req.slots, req.rules, req.cooldowns, deps.now(), req.hasImages, req.tools.length > 0);
  if (pick.candidates.length === 0) throw new RouteError(pick.reason ?? 'no_slots', pick.retryInMs);

  let lastError: unknown = null;
  let failedOver = 0;
  for (const slot of pick.candidates) {
    try {
      const key = await deps.getKey(slot.id);
      if (!key) throw new AiError('auth', '');
      const step = await deps.send(slot.provider, key, slot.model, req.system, req.messages, req.tools);
      return { step, slot, failedOver };
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      const wait = cooldownMs(e.code, e.message, e.status);
      if (wait !== undefined) req.cooldowns[slot.id] = deps.now() + wait;
      lastError = e;
      if (!shouldFailover(e.code)) throw e;
      failedOver++;
    }
  }
  throw lastError;
}
