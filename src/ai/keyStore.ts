// src/ai/keyStore.ts
// تخزين مفتاح الذكاء الاصطناعي في SecureStore (مشفّر على الجهاز).
// مفتاح لكل مزوّد، ومعاهم المزوّد المختار والموديل المختار لكل مزوّد.
// مفاتيح SecureStore مينفعش فيها ":" فبنستخدم "_".
import * as SecureStore from 'expo-secure-store';
import type { ProviderId } from './providers';

const keyName = (p: ProviderId) => `pocketforge_ai_key_${p}`;
const modelName = (p: ProviderId) => `pocketforge_ai_model_${p}`;
const ACTIVE = 'pocketforge_ai_active';
const IDS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'openrouter', 'huggingface'];

export async function loadAiKey(p: ProviderId): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(keyName(p))) ?? '';
  } catch {
    return '';
  }
}

export async function saveAiKey(p: ProviderId, key: string): Promise<void> {
  await SecureStore.setItemAsync(keyName(p), key.trim());
}

export async function clearAiKey(p: ProviderId): Promise<void> {
  try {
    await Promise.all([SecureStore.deleteItemAsync(keyName(p)), SecureStore.deleteItemAsync(modelName(p))]);
  } catch (err) {
    console.warn('AI: failed to clear key', err);
  }
}

export async function loadAiModel(p: ProviderId): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(modelName(p))) ?? '';
  } catch {
    return '';
  }
}

export async function saveAiModel(p: ProviderId, model: string): Promise<void> {
  await SecureStore.setItemAsync(modelName(p), model);
}

export async function loadActiveProvider(): Promise<ProviderId | null> {
  try {
    const v = await SecureStore.getItemAsync(ACTIVE);
    return IDS.includes(v as ProviderId) ? (v as ProviderId) : null;
  } catch {
    return null;
  }
}

export async function saveActiveProvider(p: ProviderId): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE, p);
}