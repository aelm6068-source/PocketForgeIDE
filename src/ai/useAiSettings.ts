// src/ai/useAiSettings.ts
// حالة إعداد الذكاء الاصطناعي: المزوّد، المفتاح، قائمة الموديلات، الموديل المختار.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AiError, listModels, pingModel, PROVIDERS } from './providers';
import type { ModelInfo, ProviderId } from './providers';
import type { ModelView } from './modelFilters';
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

// نتيجة اختبار موديل: ok شغال، rate المزوّد رفض بسبب الحدود (بنثبّته برضه)، fail مش شغال بالمفتاح ده
export interface ModelTest {
  id: string;
  state: 'testing' | 'ok' | 'rate' | 'fail';
  message: string;
}

export function useAiSettings() {
  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(PROVIDERS[0].id);
  const [savedKey, setSavedKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [view, setView] = useState<ModelView>('recommended');
  const [freeOnly, setFreeOnly] = useState(false);
  const [modelTest, setModelTest] = useState<ModelTest | null>(null);
  const testToken = useRef(0);
  const [test, setTest] = useState<AiTestState>('idle');
  const [error, setError] = useState('');

  const loadFor = useCallback(async (p: ProviderId) => {
    const [k, m] = await Promise.all([loadAiKey(p), loadAiModel(p)]);
    setProvider(p);
    setSavedKey(k);
    setKeyInput(k);
    setModel(m);
    setModels([]);
    setModelTest(null);
    setFreeOnly(false);
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
      if (model && !list.some((m) => m.id === model)) {
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
    if (!savedKey || models.length > 0) return;
    try {
      setModels(await listModels(provider, savedKey));
    } catch (e) {
      if (e instanceof AiError && e.code === 'auth') setError(aiErrorText(e));
    }
  }, [provider, savedKey, models.length]);

  // بنجرّب الموديل برسالة صغيرة قبل ما نثبّته، لأن القايمة ممكن تعرض موديل المفتاح ده ميقدرش يستخدمه
  const chooseModel = useCallback(
    async (id: string) => {
      const token = ++testToken.current;
      setModelTest({ id, state: 'testing', message: '' });
      try {
        await pingModel(provider, savedKey, id);
        if (token !== testToken.current) return;
        await saveAiModel(provider, id);
        setModel(id);
        setModelTest({ id, state: 'ok', message: '' });
      } catch (e) {
        if (token !== testToken.current) return;
        if (e instanceof AiError && e.code === 'rate') {
          await saveAiModel(provider, id);
          setModel(id);
          setModelTest({ id, state: 'rate', message: aiErrorText(e) });
        } else {
          setModelTest({ id, state: 'fail', message: aiErrorText(e) });
        }
      }
    },
    [provider, savedKey]
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
    view,
    setView,
    freeOnly,
    setFreeOnly,
    modelTest,
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