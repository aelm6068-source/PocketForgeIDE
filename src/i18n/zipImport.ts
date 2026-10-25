// src/i18n/zipImport.ts
// نصوص استيراد مشروع من ملف ZIP (ZipImportModal.tsx وزرار "استيراد من ZIP" في إنشاء مشروع)
export const zipImport = {
  ar: {
    zip_open: 'استيراد من ZIP',
    zip_title: 'استيراد من ZIP',
    zip_reading: 'جاري قراءة الملف...',
    zip_extracting: 'جاري فك الضغط {done}/{total}',
    zip_importing: 'جاري إنشاء المشروع...',
    zip_err_bad_zip: 'الملف ده مش ZIP سليم أو تالف.',
    zip_err_unsupported: 'نوع الـ ZIP ده مش مدعوم (مشفّر أو ضغط غير عادي).',
    zip_err_no_files: 'مفيش ملفات تقدر تتستورد من الـ ZIP ده (المجلدات المولّدة والملفات السرية بتتستبعد).',
    zip_err_too_big: 'الـ ZIP كبير جدًا للاستيراد (أكتر من 5000 ملف أو 100 ميجا بعد فك الضغط).',
    zip_err_read: 'مقدرتش أقرا الملف من الجهاز.',
    zip_err_unknown: 'حصل خطأ غير متوقع أثناء الاستيراد.',
  },
  en: {
    zip_open: 'Import from ZIP',
    zip_title: 'Import from ZIP',
    zip_reading: 'Reading the file...',
    zip_extracting: 'Extracting {done}/{total}',
    zip_importing: 'Creating the project...',
    zip_err_bad_zip: 'This file is not a valid ZIP or it is corrupted.',
    zip_err_unsupported: 'This kind of ZIP is not supported (encrypted or unusual compression).',
    zip_err_no_files: 'There are no importable files in this ZIP (generated folders and secret files are excluded).',
    zip_err_too_big: 'The ZIP is too large to import (over 5000 files or 100 MB uncompressed).',
    zip_err_read: 'Could not read the file from the device.',
    zip_err_unknown: 'An unexpected error occurred during the import.',
  },
};