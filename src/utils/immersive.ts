// src/utils/immersive.ts
// بيخفي شريط أزرار أندرويد (الرجوع/الرئيسية) زي شريط الإشعارات: لو المستخدم مفعّل "وضع الأزرار" الشريط مش بيغطي التطبيق.
// بيظهر مؤقتًا لو المستخدم سحب من حافة الشاشة. بنعيد الإخفاء لما التطبيق يرجع للواجهة أو الكيبورد يتقفل.
import { useEffect } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

export function hideNavigationBar(): void {
  if (Platform.OS !== 'android') return;
  try {
    const nb = NavigationBar as unknown as {
      setHidden?: (h: boolean) => void;
      setVisibilityAsync?: (v: 'hidden' | 'visible') => Promise<void>;
    };
    if (typeof nb.setHidden === 'function') nb.setHidden(true);
    else void nb.setVisibilityAsync?.('hidden')?.catch(() => {});
  } catch {
    // لو الموديول مش متاح مش بنوقّف التطبيق
  }
}

export function useHideNavigationBar(): void {
  useEffect(() => {
    hideNavigationBar();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') hideNavigationBar();
    });
    const kb = Keyboard.addListener('keyboardDidHide', hideNavigationBar);
    return () => {
      sub.remove();
      kb.remove();
    };
  }, []);
}
