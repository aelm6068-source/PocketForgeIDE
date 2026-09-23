// src/i18n/translations.ts
// بيجمع كل ملفات الترجمة المنفصلة (كل شاشة بملفها الخاص) في قاموس واحد نهائي
// تستخدمه LanguageContext.tsx. الملف ده مش المفروض نضيف عليه نصوص مباشرة -
// أي نص جديد يتضاف في ملف الشاشة بتاعته، وهيتجمع هنا تلقائيًا بمجرد ما نستورده
export type Language = 'ar' | 'en';

import { common } from './common';
import { projectsScreen } from './projectsScreen';
import { filesScreen } from './filesScreen';
import { settingsScreen } from './settingsScreen';
import { appDrawer } from './appDrawer';
import { runSandbox } from './runSandbox';
import { editor } from './editor';
import { preview } from './preview';

export const translations = {
 ar: {
    ...common.ar,
    ...projectsScreen.ar,
    ...filesScreen.ar,
    ...settingsScreen.ar,
    ...appDrawer.ar,
    ...runSandbox.ar,
    ...editor.ar,
    ...preview.ar,
  },
  en: {
    ...common.en,
    ...projectsScreen.en,
    ...filesScreen.en,
    ...settingsScreen.en,
    ...appDrawer.en,
    ...runSandbox.en,
    ...editor.en,
    ...preview.en,
  }, 
} as const;

export type TranslationKey = keyof typeof translations['ar'];