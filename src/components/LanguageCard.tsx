// src/components/LanguageCard.tsx
// كارت اختيار اللغة في شاشة الإعدادات: تلقائي / العربية / English
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useLanguage, LanguagePreference } from '../i18n/LanguageContext';

export default function LanguageCard() {
  const { t, preference, setPreference } = useLanguage();

  // أسماء اللغات بتتكتب بلغتها هي دايمًا، فمش بتتترجم
  const options: { key: LanguagePreference; label: string }[] = [
    { key: 'auto', label: t('settings_language_auto') },
    { key: 'ar', label: 'العربية' },
    { key: 'en', label: 'English' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('settings_language_title')}</Text>
      <Text style={styles.hint}>{t('settings_language_hint')}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = preference === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setPreference(opt.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.displaySemibold,
    fontSize: 17,
    marginBottom: spacing.xs,
  },
  hint: {
    color: colors.textFaint,
    fontFamily: fonts.ui,
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textMuted,
    fontFamily: fonts.uiSemibold,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.accent,
  },
});