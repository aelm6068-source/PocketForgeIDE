// src/ai/slotStore.ts
// ربط تخزين الخانات بالتخزين الحقيقي: بيانات في AsyncStorage (من غير مفاتيح)، والمفاتيح في SecureStore.
// المنطق كله في slotStoreCore.ts (متختبر). مفاتيح SecureStore مينفعش فيها ":" فبنستخدم "_".
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { loadActiveProvider, loadAiKey, loadAiModel } from './keyStore';
import type { ProviderId } from './providers';
import { createSlotStore, type LegacyEntry } from './slotStoreCore';
import { newSlotId } from './slots';

const LEGACY_IDS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'openrouter', 'huggingface'];

export const slotStore = createSlotStore({
  getJson: async (name) => {
    try {
      const v = await AsyncStorage.getItem(name);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  setJson: (name, value) => AsyncStorage.setItem(name, JSON.stringify(value)),
  getSecret: async (name) => {
    try {
      return (await SecureStore.getItemAsync(name)) ?? '';
    } catch {
      return '';
    }
  },
  setSecret: (name, value) => SecureStore.setItemAsync(name, value),
  delSecret: (name) => SecureStore.deleteItemAsync(name),
  legacy: async () => {
    const active = await loadActiveProvider();
    const entries: LegacyEntry[] = [];
    for (const provider of LEGACY_IDS) {
      const [key, model] = await Promise.all([loadAiKey(provider), loadAiModel(provider)]);
      entries.push({ provider, key, model });
    }
    return { active, entries };
  },
  newId: newSlotId,
});
