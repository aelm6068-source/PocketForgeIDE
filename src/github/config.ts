// src/github/config.ts
// إعدادات ربط GitHub. الـ Client ID معرّف عام (مش سر) لتطبيق OAuth اسمه PocketForge
// مسجّل على GitHub مع تفعيل Device Flow. الـ Client Secret مش موجود هنا ومش مطلوب.

export const GITHUB_CLIENT_ID = 'Ov23litA0qXmArRgtt4I';

// repo = وصول كامل للمستودعات (ننشئ مستودع ونرفع commits). workflow = رفع ملفات .github/workflows (ملفات البناء)
export const GITHUB_SCOPE = 'repo workflow';

export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_API_USER_URL = 'https://api.github.com/user';
export const GITHUB_MANAGE_APPS_URL = 'https://github.com/settings/applications';