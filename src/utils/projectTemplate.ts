// src/utils/projectTemplate.ts
// كل منطق "القالب الافتراضي" لأي مشروع جديد (الملفات + محتواها) في مكان واحد،
// بدل ما يكون متبعثر جوا FilesScreen.tsx - وده بيسهّل الإضافة عليه بعدين
// (زي إضافة ملفات ثيم أو لغات جديدة) من غير ما نلمس شاشة الملفات خالص

import { ProjectFile } from '../screens/editor/useEditorFile';
import {
  DEFAULT_ICON_BASE64,
  DEFAULT_ADAPTIVE_ICON_BASE64,
  DEFAULT_SPLASH_ICON_BASE64,
  DEFAULT_FAVICON_BASE64,
} from '../theme/defaultAssets';

export type ProjectLanguageKind = 'typescript' | 'javascript';

// يحوّل اسم المشروع (بالعربي أو الإنجليزي) لصيغة slug صالحة لـ package.json/app.json
function slugifyProjectName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'my-app';
}

// شجرة الملفات الافتراضية لأي مشروع جديد - بتشمل:
// - App.tsx/jsx + package.json + app.json في الجذر
// - src/theme/colors.ts|js (ألوان أساسية جاهزة)
// - src/locales/ (عربي/إنجليزي/فرنساوي + ملف i18n.ts|js بسيط يقرأهم)
// - assets/ (أيقونات افتراضية حقيقية)
export function buildProjectFiles(language: ProjectLanguageKind): ProjectFile[] {
  const appExt = language === 'javascript' ? 'jsx' : 'tsx';
  // ⭐ الإصلاح: ملفات الثيم واللغات لازم تاخد امتداد يطابق لغة المشروع فعليًا -
  // كانت دايمًا .ts حتى في مشاريع JavaScript، وده كان بيحط كود TypeScript
  // (types, generics) جوا مشروع مفيهوش typescript كـ dependency خالص،
  // فالبناء كان بيقع بس في مشاريع JS تحديدًا
  const scriptExt = language === 'javascript' ? 'js' : 'ts';
  const files: ProjectFile[] = [
    { id: '1', name: `App.${appExt}`, type: 'file', parentId: null },
    { id: '2', name: 'package.json', type: 'file', parentId: null },
    { id: '3', name: 'src', type: 'folder', parentId: null },
    { id: '4', name: 'app.json', type: 'file', parentId: null },
    { id: '6', name: 'assets', type: 'folder', parentId: null },
    { id: '7', name: 'icon.png', type: 'file', parentId: '6' },
    { id: '8', name: 'adaptive-icon.png', type: 'file', parentId: '6' },
    { id: '9', name: 'splash-icon.png', type: 'file', parentId: '6' },
    { id: '10', name: 'favicon.png', type: 'file', parentId: '6' },
    { id: '11', name: 'theme', type: 'folder', parentId: '3' },
    { id: '12', name: `colors.${scriptExt}`, type: 'file', parentId: '11' },
    { id: '13', name: 'locales', type: 'folder', parentId: '3' },
    { id: '14', name: 'ar.json', type: 'file', parentId: '13' },
    { id: '15', name: 'en.json', type: 'file', parentId: '13' },
    { id: '16', name: 'fr.json', type: 'file', parentId: '13' },
    { id: '17', name: `i18n.${scriptExt}`, type: 'file', parentId: '13' },
  ];
  if (language === 'typescript') {
    files.push({ id: '5', name: 'tsconfig.json', type: 'file', parentId: null });
  }
  return files;
}

// المحتوى الحقيقي لكل ملف افتراضي، بمفاتيح مطابقة للـ id بتاع الملف في buildProjectFiles
export function buildProjectFileContents(
  language: ProjectLanguageKind,
  projectName: string
): Record<string, string> {
  const isTs = language === 'typescript';
  const slug = slugifyProjectName(projectName);

  const packageJson = {
    name: slug,
    version: '1.0.0',
    main: 'expo/AppEntry.js',
    scripts: {
      start: 'expo start',
      android: 'expo start --android',
      ios: 'expo start --ios',
      web: 'expo start --web',
    },
    dependencies: {
      expo: '~57.0.0',
      'expo-status-bar': '~57.0.0',
      react: '19.2.0',
      'react-native': '0.86.3',
    },
    ...(isTs
      ? {
          devDependencies: {
            typescript: '~5.9.2',
            '@types/react': '~19.2.0',
          },
        }
      : {}),
    private: true,
  };

  const appJson = {
    expo: {
      name: projectName,
      slug,
      version: '1.0.0',
      orientation: 'portrait',
      userInterfaceStyle: 'automatic',
      newArchEnabled: true,
      icon: './assets/icon.png',
      splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#100E17',
      },
      android: {
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#100E17',
        },
      },
      web: {
        favicon: './assets/favicon.png',
      },
    },
  };

  // ثيم بسيط جاهز يقدر المستخدم يعدّل عليه بدل ما يكتب ألوان جوا كل شاشة لوحده
  // (محتواه أصلًا من غير أي صياغة TypeScript، فهو صالح لـ .ts و.js من غير تعديل)
  const themeColors = `export const colors = {
  background: '#ffffff',
  text: '#111111',
  muted: '#6b7280',
  primary: '#7C6AF2',
};
`;

  // ملفات اللغات - كل لغة بمفاتيح ترجمة بسيطة، والمستخدم يقدر يزود عليها بسهولة
  const arJson = { welcome: 'مرحبًا بيك في' };
  const enJson = { welcome: 'Welcome to' };
  const frJson = { welcome: 'Bienvenue dans' };

  // نسخة TypeScript (فيها types) - تُستخدم بس لما language === 'typescript'
  const i18nTs = `import ar from './ar.json';
import en from './en.json';
import fr from './fr.json';

export type Language = 'ar' | 'en' | 'fr';

const translations: Record<Language, Record<string, string>> = { ar, en, fr };

// يرجع الترجمة المطلوبة، ولو مش موجودة بيرجع النص العربي كافتراضي
export function t(key: string, lang: Language = 'ar'): string {
  return translations[lang]?.[key] ?? translations.ar[key] ?? key;
}
`;

  // ⭐ نسخة JavaScript بحتة (من غير أي types) - نفس المنطق بالظبط، عشان
  // مشاريع JS ما تحتوي على أي صياغة TypeScript خالص، ومتضطرش لـ typescript dependency
  const i18nJs = `import ar from './ar.json';
import en from './en.json';
import fr from './fr.json';

const translations = { ar, en, fr };

// يرجع الترجمة المطلوبة، ولو مش موجودة بيرجع النص العربي كافتراضي
export function t(key, lang = 'ar') {
  return translations[lang]?.[key] ?? translations.ar[key] ?? key;
}
`;

  // App.tsx/jsx الافتراضي بيستخدم فعليًا ملف الثيم وملف اللغات - مش بس موجودين من غير استخدام
  const appComponent = `import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './src/theme/colors';
import { t } from './src/locales/i18n';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={{ color: colors.text }}>{t('welcome', 'ar')} ${projectName}!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
`;

  const contents: Record<string, string> = {
    '1': appComponent,
    '2': JSON.stringify(packageJson, null, 2) + '\n',
    '4': JSON.stringify(appJson, null, 2) + '\n',
    '7': DEFAULT_ICON_BASE64,
    '8': DEFAULT_ADAPTIVE_ICON_BASE64,
    '9': DEFAULT_SPLASH_ICON_BASE64,
    '10': DEFAULT_FAVICON_BASE64,
    '12': themeColors,
    '14': JSON.stringify(arJson, null, 2) + '\n',
    '15': JSON.stringify(enJson, null, 2) + '\n',
    '16': JSON.stringify(frJson, null, 2) + '\n',
    '17': isTs ? i18nTs : i18nJs,
  };

  if (isTs) {
    contents['5'] = JSON.stringify(
      {
        extends: 'expo/tsconfig.base',
        compilerOptions: { strict: true, resolveJsonModule: true },
      },
      null,
      2
    ) + '\n';
  }

  return contents;
}