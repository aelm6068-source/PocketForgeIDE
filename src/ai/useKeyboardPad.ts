// src/ai/useKeyboardPad.ts
// نفس حل الكيبورد المستخدم في الطرفية: بيقيس الجزء من الشاشة اللي الكيبورد غطّاه
// ويرجّع padding سفلي علشان خانة الكتابة تفضل ظاهرة.
import { useEffect, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const KB_EXTRA = 36;

export function useKeyboardPad() {
  const rootRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const [pad, setPad] = useState(0);

  useEffect(() => {
    const measure = (screenY: number) => {
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        const overlap = Math.round(y + h - screenY);
        setPad(overlap > 0 ? overlap + Math.max(insets.bottom, KB_EXTRA) : 0);
      });
    };
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      measure(e.endCoordinates.screenY);
      setTimeout(() => measure(e.endCoordinates.screenY), 150);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [insets.bottom]);

  return { rootRef, pad };
}