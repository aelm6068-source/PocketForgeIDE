// src/i18n/translations.ts
// قاموس النصوص - عربي وإنجليزي بس حاليًا. هنضيف عليه المفاتيح تدريجيًا شاشة
// بشاشة لما نستبدل كل نص عربي مكتوب مباشرة جوه الكود بمفتاح ترجمة بدله
export type Language = 'ar' | 'en';

export const translations = {
  ar: {
    // عام - مستخدم في أكتر من شاشة
    common_cancel: 'إلغاء',
    common_save: 'حفظ',
    common_delete: 'حذف',
    common_error: 'خطأ',
    common_done: 'تم',
  },
  en: {
    common_cancel: 'Cancel',
    common_save: 'Save',
    common_delete: 'Delete',
    common_error: 'Error',
    common_done: 'Done',
  },
} as const;

export type TranslationKey = keyof typeof translations['ar'];