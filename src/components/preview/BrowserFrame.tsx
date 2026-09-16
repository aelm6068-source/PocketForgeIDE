// src/components/preview/BrowserFrame.tsx
// إطار بصري بيلف المحتوى في شكل نافذة متصفح (زي كروم) - بشريط عنوان فوق فيه
// نقط ملونة شكلية + مكان بيوري رابط الموقع الحالي. المحتوى اللي جواه (WebView)
// هو اللي بيكون شغال فعليًا في وضع المتصفح
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

type BrowserFrameProps = {
  children: React.ReactNode;
  url?: string;
};

export default function BrowserFrame({ children, url }: BrowserFrameProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.window}>
        <View style={styles.titleBar}>
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: '#FF5F57' }]} />
            <View style={[styles.dot, { backgroundColor: '#FEBC2E' }]} />
            <View style={[styles.dot, { backgroundColor: '#28C840' }]} />
          </View>
          <TouchableOpacity
            style={styles.addressBar}
            onPress={async () => {
              if (!url) return;
              await Clipboard.setStringAsync(url);
              Alert.alert('تم النسخ', url);
            }}
          >
            <Text style={styles.addressText} numberOfLines={1}>
              {url || 'localhost'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.screen}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    padding: 12,
  },
  window: {
    flex: 1,
    backgroundColor: '#0C0A13',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2438',
    overflow: 'hidden',
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#161320',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2438',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  addressBar: {
    flex: 1,
    backgroundColor: '#0C0A13',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  addressText: {
    color: '#8B87A0',
    fontSize: 11,
  },
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
});