// src/i18n/aiTools.ts
// نصوص أدوات القراءة للموديل (زرار "قراءة" + سجل الأدوات).
export const aiTools = {
  ar: {
    tools_toggle: 'قراءة',
    tools_hint: 'الموديل هيقدر يقرا ملفات المشروع بنفسه (قراءة فقط، والأسرار والملفات الثنائية محجوبة). محتوى الملفات الي بيقراها بيتبعت للمزوّد.',
    tool_list_files: 'عرض الملفات',
    tool_read_file: 'قراءة',
    tool_search_files: 'بحث',
    tools_capped: 'وقفت عند الحد الأقصى للخطوات، ممكن الرد غير مكتمل.',
  },
  en: {
    tools_toggle: 'Read',
    tools_hint: 'The model can read project files itself (read-only; secrets and binary files are blocked). The contents it reads are sent to the provider.',
    tool_list_files: 'List files',
    tool_read_file: 'Read',
    tool_search_files: 'Search',
    tools_capped: 'Stopped at the step limit, the reply may be incomplete.',
  },
} as const;
