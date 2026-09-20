// src/i18n/filesScreen.ts
// نصوص شاشة الملفات (FilesScreen.tsx) + FileActionMenu.tsx
export const filesScreen = {
  ar: {
    // شريط الأدوات والقايمة
    files_new_file_short: '+ ملف',
    files_new_folder_short: '+ مجلد',
    files_import: 'استيراد',
    files_search_placeholder: 'ابحث عن ملف أو مجلد...',
    files_search_empty: 'مفيش نتائج',

    // نافذة ملف/مجلد جديد
    files_new_file_title: 'ملف جديد',
    files_new_file_placeholder: 'مثال: index.ts',
    files_new_folder_title: 'مجلد جديد',
    files_new_folder_placeholder: 'مثال: components',
    files_rename_title: 'إعادة تسمية',
    files_rename_placeholder: 'الاسم الجديد',

    // استيراد ملف
    files_import_warning_title: 'تحذير',
    files_import_content_error: 'اتضاف الملف للقايمة لكن حصلت مشكلة في قراءة محتواه: ',
    files_import_error: 'حصلت مشكلة أثناء استيراد الملف',

    // تحميل ومشاركة
    files_share_unavailable_title: 'غير متاح',
    files_share_unavailable_message: 'المشاركة مش متاحة على الجهاز ده',
    files_download_error: 'حصلت مشكلة أثناء تجهيز الملف للتحميل',

    // نسخ المسار
    files_path_copied: 'اتنسخ المسار: ',

    // حذف
    files_delete_folder_warning: 'هيتحذف المجلد وكل اللي جواه',

    // تشغيل المشروع (فتح في Expo Go)
    files_need_key_title: 'محتاج مفتاح',
    files_need_key_message: 'روح لشاشة الإعدادات واحفظ مفتاح Daytona الأول',
    files_run_creating_sandbox: 'جاري إنشاء بيئة تشغيل جديدة...',
    files_run_reconnecting: 'جاري إعادة الاتصال ببيئة التشغيل الموجودة...',
    files_run_uploading: 'جاري رفع ملفات المشروع...',
    files_run_uploading_progress: 'جاري رفع الملفات...',
    files_run_unexpected_error: 'حصلت مشكلة غير متوقعة أثناء التشغيل',

    // تنظيف السيرفر
    files_cleanup_title: 'تنظيف السيرفر',
    files_cleanup_confirm_message: 'هيتم مسح سيرفر المشروع ده (هيشتغل من جديد المرة الجاية)، وأي سيرفرات تايهة مش تابعة لأي مشروع عندك. متأكد؟',
    files_cleanup_confirm_button: 'مسح',
    files_cleanup_success: 'اتمسح سيرفر المشروع ده',
    files_cleanup_success_orphans_suffix: '، وكمان',
    files_cleanup_success_orphans_word: 'سيرفر تايه',
    files_cleanup_error: 'حصلت مشكلة أثناء تنظيف السيرفر: ',

    // معاينة الصور
    files_image_no_content: 'مفيش محتوى محفوظ للصورة دي',
    files_image_close_hint: 'دوس في أي مكان للإغلاق',

    // FileActionMenu.tsx - قايمة إجراءات الملف/المجلد
    files_action_rename: 'إعادة تسمية',
    files_action_copy_path: 'نسخ المسار',
    files_action_duplicate: 'تكرار الملف',
    files_action_download: 'تحميل',
    files_action_add_file: 'إضافة ملف',
    files_action_add_folder: 'إضافة مجلد',
  },
  en: {
    files_new_file_short: '+ File',
    files_new_folder_short: '+ Folder',
    files_import: 'Import',
    files_search_placeholder: 'Search for a file or folder...',
    files_search_empty: 'No results',

    files_new_file_title: 'New File',
    files_new_file_placeholder: 'e.g. index.ts',
    files_new_folder_title: 'New Folder',
    files_new_folder_placeholder: 'e.g. components',
    files_rename_title: 'Rename',
    files_rename_placeholder: 'New name',

    files_import_warning_title: 'Warning',
    files_import_content_error: 'File added to the list, but there was a problem reading its content: ',
    files_import_error: 'A problem occurred while importing the file',

    files_share_unavailable_title: 'Not Available',
    files_share_unavailable_message: 'Sharing is not available on this device',
    files_download_error: 'A problem occurred while preparing the file for download',

    files_path_copied: 'Path copied: ',

    files_delete_folder_warning: 'The folder and everything inside it will be deleted',

    files_need_key_title: 'Key Required',
    files_need_key_message: 'Go to Settings and save your Daytona key first',
    files_run_creating_sandbox: 'Creating a new runtime environment...',
    files_run_reconnecting: 'Reconnecting to the existing runtime environment...',
    files_run_uploading: 'Uploading project files...',
    files_run_uploading_progress: 'Uploading files...',
    files_run_unexpected_error: 'An unexpected problem occurred while running',

    files_cleanup_title: 'Clean Up Server',
    files_cleanup_confirm_message: 'This project\'s server will be cleared (it will start fresh next time), along with any orphaned servers not tied to any of your projects. Are you sure?',
    files_cleanup_confirm_button: 'Clear',
    files_cleanup_success: 'This project\'s server has been cleared',
    files_cleanup_success_orphans_suffix: ', and also',
    files_cleanup_success_orphans_word: 'orphaned server(s)',
    files_cleanup_error: 'A problem occurred while cleaning up the server: ',

    files_image_no_content: 'No saved content for this image',
    files_image_close_hint: 'Tap anywhere to close',

    files_action_rename: 'Rename',
    files_action_copy_path: 'Copy Path',
    files_action_duplicate: 'Duplicate File',
    files_action_download: 'Download',
    files_action_add_file: 'Add File',
    files_action_add_folder: 'Add Folder',
  },
};