// src/i18n/github.ts
// نصوص ربط GitHub (بطاقة الإعدادات). أكواد الأخطاء github_err_* ليها نفس أسماء
// AuthErrorCode في src/github/auth.ts
export const github = {
  ar: {
    github_title: 'GitHub',
    github_hint: 'اربط حسابك مرة واحدة، وكل مشروع بيتحفظ في مستودع خاص بيه على GitHub',
    github_permission_note:
      'التطبيق هيطلب صلاحية الوصول لمستودعاتك (العامة والخاصة) عشان ينشئ مستودع لكل مشروع ويرفع ملفاته. تقدر تفصل الحساب في أي وقت.',
    github_connect: 'ربط حساب GitHub',
    github_connected_as: 'متصل كـ {login}',
    github_checking: 'جاري التحميل...',

    github_code_title: 'اكتب الكود ده في صفحة GitHub',
    github_code_steps: 'اضغط الزرار، هيتنسخ الكود وتفتح صفحة GitHub. الصق الكود ووافق، وارجع للتطبيق.',
    github_open_copy: 'نسخ الكود وفتح GitHub',
    github_waiting: 'في انتظار موافقتك على GitHub...',
    github_cancel: 'إلغاء',

    github_disconnect: 'فصل الحساب',
    github_disconnect_title: 'فصل حساب GitHub؟',
    github_disconnect_body:
      'هيتم حذف الربط من التطبيق بس، ومشاريعك ومستودعاتك على GitHub مش هتتأثر. لإلغاء صلاحية التطبيق نهائيًا من GitHub استخدم "إدارة الصلاحيات".',
    github_manage: 'إدارة الصلاحيات على GitHub',
    github_open_error: 'مش قادر أفتح الرابط دلوقتي',

    github_err_network: 'مفيش اتصال بالإنترنت أو GitHub مش بيرد. جرّب تاني.',
    github_err_bad_client: 'معرّف التطبيق (Client ID) غير صحيح. راجعه في إعدادات تطبيق OAuth على GitHub.',
    github_err_flow_disabled: 'تسجيل الدخول بالكود (Device Flow) مش مفعّل في إعدادات تطبيق OAuth على GitHub.',
    github_err_expired: 'انتهت مهلة الكود. اضغط "ربط" تاني عشان تاخد كود جديد.',
    github_err_denied: 'رفضت الربط على GitHub. لو غيّرت رأيك اضغط "ربط" تاني.',
    github_err_cancelled: 'اتلغى الربط.',
    github_err_unauthorized: 'GitHub رفض التوكن. اربط الحساب تاني.',
    github_err_unknown: 'حصل خطأ غير متوقع أثناء الربط. جرّب تاني.',
  },
  en: {
    github_title: 'GitHub',
    github_hint: 'Connect your account once, and every project is saved to its own repository on GitHub',
    github_permission_note:
      "The app will ask for access to your repositories (public and private) so it can create a repository for each project and upload its files. You can disconnect at any time.",
    github_connect: 'Connect GitHub account',
    github_connected_as: 'Connected as {login}',
    github_checking: 'Loading...',

    github_code_title: 'Enter this code on the GitHub page',
    github_code_steps: 'Tap the button: the code is copied and GitHub opens. Paste the code, approve, then come back to the app.',
    github_open_copy: 'Copy code and open GitHub',
    github_waiting: 'Waiting for your approval on GitHub...',
    github_cancel: 'Cancel',

    github_disconnect: 'Disconnect',
    github_disconnect_title: 'Disconnect GitHub?',
    github_disconnect_body:
      'This only removes the link from the app. Your projects and repositories on GitHub are not affected. To revoke the app\'s access completely, use "Manage access on GitHub".',
    github_manage: 'Manage access on GitHub',
    github_open_error: 'Could not open the link right now',

    github_err_network: 'No internet connection, or GitHub is not responding. Try again.',
    github_err_bad_client: 'The app Client ID is not valid. Check it in the OAuth app settings on GitHub.',
    github_err_flow_disabled: 'Device Flow is not enabled in the OAuth app settings on GitHub.',
    github_err_expired: 'The code expired. Tap "Connect" again to get a new one.',
    github_err_denied: 'You declined on GitHub. Tap "Connect" again if you change your mind.',
    github_err_cancelled: 'Connection cancelled.',
    github_err_unauthorized: 'GitHub rejected the token. Connect the account again.',
    github_err_unknown: 'An unexpected error happened while connecting. Try again.',
  },
};