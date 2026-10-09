// src/i18n/translate.ts
// ترجمة للملفات اللي مش مكونات React (زي utils/daytonaClient.ts) - دي مينفعش
// تستخدم hook، فمبنقراش اللغة من الـ Context مباشرة. LanguageProvider بيحدّث
// اللغة الحالية هنا كل ما تتغير.
import { translations, Language, TranslationKey } from './translations';

let currentLanguage: Language = 'ar';

export function setCurrentLanguage(lang: Language): void {
  currentLanguage = lang;
}

// params اختيارية: بتستبدل {name} جوه النص بالقيمة (مثلًا {status} بكود الخطأ)
export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let text: string = translations[currentLanguage][key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}