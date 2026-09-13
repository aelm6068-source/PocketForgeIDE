// src/components/preview/MobileFrame.tsx
// إطار بصري بيلف المحتوى في شكل شاشة موبايل (زي الصورة اللي بعتها) - مجرد
// "فريم" شكلي بس، مفيهوش أي منطق تشغيل حقيقي، وظيفته إنه يخلي المعاينة تبان
// وكأنها جوه تليفون حقيقي بدل ما تكون مفروشة عادي على الشاشة
import React from 'react';
import { View, StyleSheet } from 'react-native';

type MobileFrameProps = {
  children: React.ReactNode;
};

export default function MobileFrame({ children }: MobileFrameProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.bezel}>
        {/* الشق العلوي (notch) - شكلي بس، زي شاشات الموبايل الحديثة */}
        <View style={styles.notch} />
        <View style={styles.screen}>{children}</View>
        {/* خط الهوم بار تحت - شكلي برضو */}
        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  bezel: {
    flex: 1,
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0C0A13',
    borderRadius: 36,
    borderWidth: 8,
    borderColor: '#1C1826',
    overflow: 'hidden',
    position: 'relative',
  },
  notch: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 120,
    height: 22,
    backgroundColor: '#1C1826',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    zIndex: 2,
  },
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    width: 100,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3550',
    zIndex: 2,
  },
});