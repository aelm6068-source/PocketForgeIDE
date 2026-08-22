// src/theme/colors.ts
// كل الألوان والخطوط المستخدمة في التطبيق - مصدر واحد لكل حاجة بصرية

export const colors = {
  // الخلفيات
  background: '#100E17',
  surface: '#1B1826',
  surfaceElevated: '#241F33',
  border: '#322C47',

  // اللون المميز (البنفسجي)
  accent: '#7C6AF2',
  accentDim: '#4A3F8C',
  accentGlow: 'rgba(124,106,242,0.35)',

  // النصوص
  text: '#F1EFFA',
  textMuted: '#948FB0',
  textFaint: '#5E5878',

  // ألوان الحالة
  success: '#4ADE9C',
  warning: '#F2B84A',
  error: '#F2607A',

  // ألوان تصنيف اللغات
  typescript: '#B3A7FF',
  javascript: '#F2B84A',
};

export const fonts = {
  // خط العرض الأساسي (العناوين)
  display: 'Sora_700Bold',
  displaySemibold: 'Sora_600SemiBold',

  // خط الكود
  code: 'JetBrainsMono_400Regular',
  codeMedium: 'JetBrainsMono_500Medium',
  codeBold: 'JetBrainsMono_700Bold',

  // خط الواجهة العادي (نصوص عربي/إنجليزي)
  ui: 'Cairo_400Regular',
  uiMedium: 'Cairo_500Medium',
  uiSemibold: 'Cairo_600SemiBold',
  uiBold: 'Cairo_700Bold',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  pill: 999,
};