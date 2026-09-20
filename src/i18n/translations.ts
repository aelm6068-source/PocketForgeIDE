// src/i18n/translations.ts
// بيجمع كل ملفات الترجمة المنفصلة (كل شاشة بملفها الخاص) في قاموس واحد نهائي
// تستخدمه LanguageContext.tsx. الملف ده مش المفروض نضيف عليه نصوص مباشرة -
// أي نص جديد يتضاف في ملف الشاشة بتاعته، وهيتجمع هنا تلقائيًا بمجرد ما نستورده
export type Language = 'ar' | 'en';

import { common } from './common';
// هنضيف باقي الاستيرادات هنا (filesScreen, settingsScreen, ...) أول ما نملأهم

export const translations = {
  ar: {
    ...common.ar,
  },
  en: {
    ...common.en,
  },
} as const;

export type TranslationKey = keyof typeof translations['ar'];