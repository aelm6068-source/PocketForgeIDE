// src/i18n/preview.ts
// نصوص شاشة المعاينة (PreviewPanel.tsx + BrowserFrame.tsx) - MobileFrame.tsx
// وPreviewToggle.tsx مفيهومش نص، بس أيقونات
export const preview = {
  ar: {
    preview_need_key: 'محتاج تحفظ مفتاح Daytona في الإعدادات الأول',
    preview_preparing: 'جاري التجهيز...',
    preview_creating_sandbox: 'جاري إنشاء بيئة تشغيل...',
    preview_uploading_files: 'جاري رفع ملفات المشروع...',
    preview_unexpected_error: 'حصلت مشكلة غير متوقعة أثناء تجهيز المعاينة',

    preview_webview_error_title: 'خطأ WebView',
    preview_http_error_title: 'خطأ HTTP',
    preview_page_error_title: 'خطأ جوه الصفحة',
    preview_retry: 'إعادة المحاولة',

    preview_mobile_mode_warning: '⚠️ دي معاينة شكل تقريبية بس - التشغيل الحقيقي الكامل في تطبيق Expo Go، والمعاينة هنا حاليًا بتعرض App.tsx فقط من غير تفاعل حقيقي',

    preview_url_copied_title: 'تم النسخ',
  },
  en: {
    preview_need_key: 'You need to save your Daytona key in Settings first',
    preview_preparing: 'Preparing...',
    preview_creating_sandbox: 'Creating runtime environment...',
    preview_uploading_files: 'Uploading project files...',
    preview_unexpected_error: 'An unexpected problem occurred while preparing the preview',

    preview_webview_error_title: 'WebView Error',
    preview_http_error_title: 'HTTP Error',
    preview_page_error_title: 'In-page Error',
    preview_retry: 'Retry',

    preview_mobile_mode_warning: '⚠️ This is an approximate visual preview only - full real execution happens in the Expo Go app, and this preview currently shows App.tsx only, with no real interaction',

    preview_url_copied_title: 'Copied',
  },
};