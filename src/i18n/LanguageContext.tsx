// src/i18n/LanguageContext.tsx
// المحرك الفعلي لنظام الترجمة: بيوفر اللغة الحالية، دالة t()، ودالة تغيير اللغة.
// بيحفظ اختيار المستخدم في AsyncStorage، وأول مرة يفتح فيها التطبيق بيحدد اللغة
// الافتراضية حسب لغة الهاتف (عربي لو الهاتف عربي، إنجليزي لأي لغة تانية).
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { I18nManager, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { translations, Language, TranslationKey } from './translations';

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
  language: Language;
  isLoading: boolean;
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Language) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        const initial: Language = saved === 'ar' || saved === 'en' ? saved : getDeviceDefaultLanguage();
        setLanguageState(initial);

        const shouldBeRTL = initial === 'ar';
        if (I18nManager.isRTL !== shouldBeRTL) {
          I18nManager.allowRTL(shouldBeRTL);
          I18nManager.forceRTL(shouldBeRTL);
        }
      } catch {
        setLanguageState('ar');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] ?? key;
    },
    [language]
  );

  const setLanguage = useCallback(async (lang: Language) => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    setLanguageState(lang);

    const shouldBeRTL = lang === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      Alert.alert(
        lang === 'ar' ? 'إعادة تشغيل مطلوبة' : 'Restart Required',
        lang === 'ar'
          ? 'لازم تقفل التطبيق وتفتحه تاني عشان اتجاه الكتابة يتغيّر بالكامل.'
          : 'Please close and reopen the app for the layout direction to fully update.'
      );
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, isLoading, t, setLanguage }}>
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