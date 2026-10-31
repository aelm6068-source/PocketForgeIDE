// src/ai/useAiSettings.ts
// حالة إعداد الذكاء الاصطناعي: المزوّد، المفتاح، قائمة الموديلات، الموديل المختار.
import { useCallback, useEffect, useState } from 'react';
import { AiError, listModels, PROVIDERS } from './providers';
import type { ProviderId } from './providers';
import {
  clearAiKey,
  loadActiveProvider,
  loadAiKey,
  loadAiModel,
  saveActiveProvider,
  saveAiKey,
  saveAiModel,
} from './keyStore';
import { aiErrorText } from './aiErrors';

export type AiTestState = 'idle' | 'testing' | 'ok' | 'error';

export function useAiSettings() {
  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(PROVIDERS[0].id);
  const [savedKey, setSavedKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [test, setTest] = useState<AiTestState>('idle');
  const [error, setError] = useState('');

  const loadFor = useCallback(async (p: ProviderId) => {
    const [k, m] = await Promise.all([loadAiKey(p), loadAiModel(p)]);
    setProvider(p);
    setSavedKey(k);
    setKeyInput(k);
    setModel(m);
    setModels([]);
    setTest('idle');
    setError('');
    return k;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const active = (await loadActiveProvider()) ?? PROVIDERS[0].id;
      await loadFor(active);
      if (alive) setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [loadFor]);

  const selectProvider = useCallback(
    async (p: ProviderId) => {
      await saveActiveProvider(p);
      await loadFor(p);
    },
    [loadFor]
  );

  // بيختبر المفتاح بطلب قايمة الموديلات؛ لو نجح بيحفظه ويعرض القايمة
  const testAndSave = useCallback(async () => {
    const key = keyInput.trim();
    if (!key) return;
    setTest('testing');
    setError('');
    try {
      const list = await listModels(provider, key);
      await saveAiKey(provider, key);
      await saveActiveProvider(provider);
      setSavedKey(key);
      setModels(list);
      if (model && !list.includes(model)) {
        setModel('');
        await saveAiModel(provider, '');
      }
      setTest('ok');
    } catch (e) {
      setTest('error');
      setError(aiErrorText(e));
    }
  }, [keyInput, provider, model]);

  // بيعيد جلب القايمة بالمفتاح المحفوظ (لما المستخدم يفتح الإعدادات بعد ما حفظ قبل كده)
  const refreshModels = useCallback(async () => {
    if (!savedKey) return;
    try {
      setModels(await listModels(provider, savedKey));
    } catch (e) {
      if (e instanceof AiError && e.code === 'auth') setError(aiErrorText(e));
    }
  }, [provider, savedKey]);

  const chooseModel = useCallback(
    async (m: string) => {
      setModel(m);
      await saveAiModel(provider, m);
    },
    [provider]
  );

  const removeKey = useCallback(async () => {
    await clearAiKey(provider);
    await loadFor(provider);
  }, [provider, loadFor]);

  return {
    loaded,
    provider,
    savedKey,
    keyInput,
    setKeyInput,
    model,
    models,
    test,
    error,
    ready: loaded && !!savedKey && !!model,
    selectProvider,
    testAndSave,
    refreshModels,
    chooseModel,
    removeKey,
  };
}