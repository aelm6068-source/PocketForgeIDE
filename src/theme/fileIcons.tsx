// src/theme/fileIcons.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface IconConfig {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  bg: string;
}

const TS_COLOR = '#3178C6';
const TS_BG = 'rgba(49,120,198,0.15)';
const JS_COLOR = '#F7DF1E';
const JS_BG = 'rgba(247,223,30,0.12)';

const iconMap: Record<string, IconConfig> = {
  // TypeScript — ملف منطق عادي
  ts: { name: 'language-typescript', color: TS_COLOR, bg: TS_BG },
  // TypeScript + React (component) — أيقونة React مميزة بنفس اللون الأزرق
  tsx: { name: 'react', color: TS_COLOR, bg: TS_BG },

  // JavaScript — ملف منطق عادي
  js: { name: 'language-javascript', color: JS_COLOR, bg: JS_BG },
  // JavaScript + React (component) — أيقونة React مميزة بنفس اللون الأصفر
  jsx: { name: 'react', color: JS_COLOR, bg: JS_BG },

  json: { name: 'code-json', color: '#F2C94C', bg: 'rgba(242,201,76,0.12)' },
  md: { name: 'language-markdown', color: '#C4C4C4', bg: 'rgba(196,196,196,0.1)' },
  css: { name: 'language-css3', color: '#2965F1', bg: 'rgba(41,101,241,0.12)' },
  html: { name: 'language-html5', color: '#E44D26', bg: 'rgba(228,77,38,0.12)' },

  png: { name: 'file-image', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  jpg: { name: 'file-image', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  jpeg: { name: 'file-image', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  svg: { name: 'svg', color: '#FFB13B', bg: 'rgba(255,177,59,0.12)' },

  env: { name: 'key-variant', color: '#4ADE9C', bg: 'rgba(74,222,156,0.12)' },
  gitignore: { name: 'git', color: '#F2607A', bg: 'rgba(242,96,122,0.12)' },
  yml: { name: 'file-cog-outline', color: '#CB171E', bg: 'rgba(203,23,30,0.12)' },
  yaml: { name: 'file-cog-outline', color: '#CB171E', bg: 'rgba(203,23,30,0.12)' },
  lock: { name: 'lock-outline', color: '#948FB0', bg: 'rgba(148,143,176,0.1)' },

  default: { name: 'file-outline', color: '#948FB0', bg: 'rgba(148,143,176,0.1)' },
};

export function getFileIcon(fileName: string): IconConfig {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return iconMap[ext] || iconMap.default;
}

export function FileIconBadge({ fileName }: { fileName: string }) {
  const icon = getFileIcon(fileName);
  return (
    <View style={[styles.badge, { backgroundColor: icon.bg }]}>
      <MaterialCommunityIcons name={icon.name} size={17} color={icon.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});