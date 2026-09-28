// src/i18n/LanguageContext.tsx
// المحرك الفعلي لنظام الترجمة: بيوفر اللغة الحالية، دالة t()، واختيار المستخدم.
// الاختيار ممكن يكون: 'auto' (حسب لغة الهاتف: عربي لو الهاتف عربي، إنجليزي لأي لغة تانية)
// أو 'ar' أو 'en' يدويًا. الاختيار بيتحفظ في AsyncStorage.
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { translations, Language, TranslationKey } from './translations';

export type LanguagePreference = 'auto' | 'ar' | 'en';

const LANGUAGE_STORAGE_KEY = 'pocketforge:language';

function getDeviceDefaultLanguage(): Language {
  try {
    const locales = Localization.getLocales();
    const code = locales[0]?.languageCode ?? 'en';
    return code === 'ar' ? 'ar' : 'en';
  } catch {
    return 'ar';
  }
}

interface LanguageContextValue {
  language: Language; // اللغة الفعلية المستخدمة دلوقتي
  preference: LanguagePreference; // اختيار المستخدم (auto / ar / en)
  isLoading: boolean;
  t: (key: TranslationKey) => string;
  setPreference: (pref: LanguagePreference) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LanguagePreference>('auto');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === 'auto' || saved === 'ar' || saved === 'en') {
          setPreferenceState(saved);
        }
      } catch {
        // لو فشلت القراءة نفضل على 'auto'
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const language: Language = useMemo(
    () => (preference === 'auto' ? getDeviceDefaultLanguage() : preference),
    [preference]
  );

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] ?? key;
    },
    [language]
  );

  const setPreference = useCallback(async (pref: LanguagePreference) => {
    setPreferenceState(pref);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, pref);
    } catch {
      // التغيير شغال في الجلسة الحالية حتى لو فشل الحفظ
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, preference, isLoading, t, setPreference }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage لازم يتستخدم جوه LanguageProvider');
  }
  return context;
}