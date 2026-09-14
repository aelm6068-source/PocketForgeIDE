// src/components/preview/PreviewToggle.tsx
// زرار التبديل بين وضع "موبايل" (شكل بس) ووضع "متصفح" (معاينة حقيقية شغالة)
// - مجرد UI، القرار الفعلي بيتاخد في PreviewPanel.tsx اللي بيستخدمه
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../theme/colors';

export type PreviewMode = 'mobile' | 'browser';

type PreviewToggleProps = {
  mode: PreviewMode;
  onChange: (mode: PreviewMode) => void;
};

export default function PreviewToggle({ mode, onChange }: PreviewToggleProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.option, mode === 'mobile' && styles.optionActive]}
        onPress={() => onChange('mobile')}
        activeOpacity={0.75}
      >
        <Ionicons
          name="phone-portrait-outline"
          size={18}
          color={mode === 'mobile' ? 'white' : colors.textMuted}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.option, mode === 'browser' && styles.optionActive]}
        onPress={() => onChange('browser')}
        activeOpacity={0.75}
      >
        <Ionicons
          name="globe-outline"
          size={18}
          color={mode === 'browser' ? 'white' : colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 3,
    gap: 3,
  },
  option: {
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  optionActive: {
    backgroundColor: colors.accent,
  },
});