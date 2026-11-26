// src/icons/iconMeta.ts
// بيانات مجموعات الأيقونات + دوال البحث وبناء الكود. منطق بحت (من غير react) علشان يتختبر.
export type IconSetId = 'Ionicons' | 'MaterialIcons' | 'MaterialCommunityIcons' | 'Feather' | 'AntDesign' | 'FontAwesome';

export interface IconSetMeta {
  id: IconSetId;
  label: string;
}

// الاسم هو نفسه اسم الاستيراد من '@expo/vector-icons'
export const ICON_SETS: IconSetMeta[] = [
  { id: 'Ionicons', label: 'Ionicons' },
  { id: 'MaterialIcons', label: 'Material' },
  { id: 'MaterialCommunityIcons', label: 'Material Community' },
  { id: 'Feather', label: 'Feather' },
  { id: 'AntDesign', label: 'AntDesign' },
  { id: 'FontAwesome', label: 'FontAwesome' },
];

export const MAX_SHOWN = 800;

// بحث بالاسم (حروف صغيرة، أجزاء مفصولة بمسافة = كلها لازم تكون موجودة)
export function filterIcons(names: string[], query: string): string[] {
  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return names;
  return names.filter((n) => {
    const low = n.toLowerCase();
    return parts.every((p) => low.includes(p));
  });
}

export function importLine(set: IconSetId): string {
  return `import { ${set} } from '@expo/vector-icons';`;
}

export function jsxSnippet(set: IconSetId, name: string, size = 24): string {
  return `<${set} name="${name}" size={${size}} color="#FFFFFF" />`;
}
