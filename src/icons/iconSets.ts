// src/icons/iconSets.ts
// بيربط كل مجموعة بمكوّنها وقايمة أسمائها. الخطوط والأسماء موجودة أصلًا جوه التطبيق (@expo/vector-icons)،
// فمفيش تنزيل ولا صور ولا حجم زيادة.
import { AntDesign, Feather, FontAwesome, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type { IconSetId } from './iconMeta';

const COMPONENTS: Record<IconSetId, any> = { Ionicons, MaterialIcons, MaterialCommunityIcons, Feather, AntDesign, FontAwesome };
const cache: Partial<Record<IconSetId, string[]>> = {};

export function iconComponent(set: IconSetId): any {
  return COMPONENTS[set];
}

// أسماء المجموعة مرتبة أبجديًا (بتتحسب مرة وبتتخزن)
export function iconNames(set: IconSetId): string[] {
  if (!cache[set]) {
    const map = COMPONENTS[set]?.glyphMap;
    cache[set] = map && typeof map === 'object' ? Object.keys(map).sort() : [];
  }
  return cache[set]!;
}
