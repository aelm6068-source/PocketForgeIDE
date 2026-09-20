// src/i18n/settingsScreen.ts
// نصوص شاشة الإعدادات (SettingsScreen.tsx)
export const settingsScreen = {
  ar: {
    settings_title: 'الإعدادات',
    settings_subtitle: 'إدارة مفاتيح تشغيل المشاريع على السيرفر — اضغط على الكارت عشان تخليه المزوّد النشط',

    // تنبيهات عامة
    settings_alert_title: 'تنبيه',
    settings_enter_key_first: 'من فضلك أدخل المفتاح قبل الحفظ',
    settings_save_key_error: 'حصل خطأ أثناء حفظ المفتاح، حاول تاني',
    settings_open_link_error: 'مش قادر أفتح الرابط دلوقتي',
    settings_enter_token_first: 'من فضلك أدخل التوكن قبل الحفظ',
    settings_save_token_error: 'حصل خطأ أثناء حفظ التوكن، حاول تاني',
    settings_test_need_key_first: 'محتاج تحفظ المفتاح الأول قبل الاختبار',
    settings_test_e2b_unavailable: 'اختبار الاتصال بـ E2B لسه مش متاح',
    settings_test_unexpected_error: 'حصل خطأ غير متوقع أثناء الاختبار',

    // كارت المزوّد (E2B/Daytona)
    settings_active_badge: 'نشط',
    settings_tap_to_activate: 'اضغط للتفعيل',
    settings_get_key_link: 'احصل على مفتاح ↗',
    settings_save_button: 'حفظ',
    settings_saved_checkmark: 'تم الحفظ ✓',
    settings_show: 'إظهار',
    settings_hide: 'إخفاء',
    settings_test_connection: 'اختبار الاتصال',
    settings_testing: 'جاري الاختبار...',

    // كارت Expo Token
    settings_expo_token_title: 'Expo Token (اختياري)',
    settings_expo_token_hint: 'بيحسّن استقرار الـ tunnel وقت التشغيل - مش إجباري',
    settings_expo_token_placeholder: 'توكن Personal Access من expo.dev',

    // ملاحظة أسفل الشاشة
    settings_footer_note: 'المفاتيح بتتخزن مشفّرة على جهازك فقط، ومبتتبعتش لأي سيرفر تاني غير مزوّد التشغيل نفسه.',
  },
  en: {
    settings_title: 'Settings',
    settings_subtitle: 'Manage the keys used to run projects on the server — tap a card to make it the active provider',

    settings_alert_title: 'Notice',
    settings_enter_key_first: 'Please enter the key before saving',
    settings_save_key_error: 'An error occurred while saving the key, please try again',
    settings_open_link_error: "Can't open the link right now",
    settings_enter_token_first: 'Please enter the token before saving',
    settings_save_token_error: 'An error occurred while saving the token, please try again',
    settings_test_need_key_first: 'You need to save the key first before testing',
    settings_test_e2b_unavailable: 'E2B connection testing is not available yet',
    settings_test_unexpected_error: 'An unexpected error occurred during testing',

    settings_active_badge: 'Active',
    settings_tap_to_activate: 'Tap to activate',
    settings_get_key_link: 'Get a key ↗',
    settings_save_button: 'Save',
    settings_saved_checkmark: 'Saved ✓',
    settings_show: 'Show',
    settings_hide: 'Hide',
    settings_test_connection: 'Test Connection',
    settings_testing: 'Testing...',

    settings_expo_token_title: 'Expo Token (Optional)',
    settings_expo_token_hint: "Improves tunnel stability while running - not required",
    settings_expo_token_placeholder: 'Personal Access token from expo.dev',

    settings_footer_note: "Keys are stored encrypted on your device only, and are never sent to any server other than the runtime provider itself.",
  },
};