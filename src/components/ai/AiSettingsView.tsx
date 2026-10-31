// src/components/ai/AiSettingsView.tsx
// إعداد الذكاء الاصطناعي: اختيار المزوّد، إدخال المفتاح واختباره، واختيار الموديل.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { PROVIDERS } from '../../ai/providers';
import type { useAiSettings } from '../../ai/useAiSettings';
import { useKeyboardPad } from '../../ai/useKeyboardPad';

type Settings = ReturnType<typeof useAiSettings>;
interface Props {
  s: Settings;
  onDone: () => void; // بدء المحادثة
  onCancel?: () => void; // رجوع للمحادثة (لو الإعداد جاهز بالفعل)
}

const MAX_SHOWN = 60;

export default function AiSettingsView({ s, onDone, onCancel }: Props) {
  const { t } = useLanguage();
  const { rootRef, pad } = useKeyboardPad();
  const [showKey, setShowKey] = useState(false);
  const [filter, setFilter] = useState('');
  const info = PROVIDERS.find((p) => p.id === s.provider) ?? PROVIDERS[0];

  const { savedKey, refreshModels } = s;
  useEffect(() => {
    if (savedKey) void refreshModels();
  }, [savedKey, refreshModels]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? s.models.filter((m) => m.toLowerCase().includes(q)) : s.models;
    return list.slice(0, MAX_SHOWN);
  }, [s.models, filter]);

  const confirmRemove = () => {
    Alert.alert(t('ai_remove_key'), t('ai_remove_confirm').split('{name}').join(info.name), [
      { text: t('ai_cancel'), style: 'cancel' },
      { text: t('ai_remove_btn'), style: 'destructive', onPress: () => void s.removeKey() },
    ]);
  };

  return (
    <View ref={rootRef} style={[styles.root, { paddingBottom: pad }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.title}>{t('ai_settings_title')}</Text>
          {onCancel ? (
            <TouchableOpacity onPress={onCancel} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.intro}>{t('ai_intro')}</Text>

        <Text style={styles.label}>{t('ai_provider')}</Text>
        <View style={styles.chips}>
          {PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, p.id === s.provider && styles.chipOn]}
              onPress={() => void s.selectProvider(p.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, p.id === s.provider && styles.chipTextOn]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {info.free ? <Text style={styles.free}>{t('ai_free_badge')}</Text> : null}

        <View style={styles.rowBetween}>
          <Text style={styles.label}>{t('ai_key_label')}</Text>
          <TouchableOpacity onPress={() => void Linking.openURL(info.keyUrl)} activeOpacity={0.7}>
            <Text style={styles.link}>{t('ai_get_key')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={s.keyInput}
            onChangeText={s.setKeyInput}
            placeholder={t('ai_key_placeholder')}
            placeholderTextColor={colors.textFaint}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
          <TouchableOpacity onPress={() => setShowKey((v) => !v)} style={styles.eye} activeOpacity={0.7}>
            <Text style={styles.eyeText}>{showKey ? t('ai_hide') : t('ai_show')}</Text>
          </TouchableOpacity>
        </View>

        {info.hintKey ? <Text style={styles.hint}>{t(info.hintKey as TranslationKey)}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primary, (!s.keyInput.trim() || s.test === 'testing') && styles.disabled]}
            onPress={() => void s.testAndSave()}
            disabled={!s.keyInput.trim() || s.test === 'testing'}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryText}>{s.test === 'testing' ? t('ai_testing') : t('ai_test_save')}</Text>
          </TouchableOpacity>
          {s.savedKey ? (
            <TouchableOpacity style={styles.danger} onPress={confirmRemove} activeOpacity={0.8}>
              <Text style={styles.dangerText}>{t('ai_remove_key')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {s.test === 'ok' ? <Text style={styles.ok}>{t('ai_key_ok')}</Text> : null}
        {s.error ? <Text style={styles.err}>{s.error}</Text> : null}

        {s.savedKey && s.models.length > 0 ? (
          <View>
            <Text style={styles.label}>{t('ai_model_label')}</Text>
            {s.model ? (
              <Text style={styles.selected}>
                {t('ai_model_selected')}: {s.model}
              </Text>
            ) : null}
            <TextInput
              style={[styles.input, styles.filter]}
              value={filter}
              onChangeText={setFilter}
              placeholder={t('ai_model_filter')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            {shown.length === 0 ? <Text style={styles.intro}>{t('ai_model_none')}</Text> : null}
            {shown.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modelRow, m === s.model && styles.modelRowOn]}
                onPress={() => void s.chooseModel(m)}
                activeOpacity={0.7}
              >
                <Text style={styles.modelText} numberOfLines={1}>
                  {m}
                </Text>
                {m === s.model ? <Ionicons name="checkmark" size={16} color={colors.success} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {s.ready ? (
          <TouchableOpacity style={[styles.primary, styles.startBtn]} onPress={onDone} activeOpacity={0.8}>
            <Text style={styles.primaryText}>{t('ai_start_chat')}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontFamily: fonts.displaySemibold, fontSize: 18 },
  iconBtn: { padding: spacing.xs },
  intro: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 20, marginVertical: spacing.sm },
  label: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: colors.accent, fontFamily: fonts.uiMedium, fontSize: 12.5, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipText: { color: colors.textMuted, fontFamily: fonts.uiMedium, fontSize: 12.5 },
  chipTextOn: { color: colors.text },
  hint: { color: colors.warning, fontFamily: fonts.ui, fontSize: 12, lineHeight: 19, marginTop: spacing.sm },
  free: { color: colors.success, fontFamily: fonts.ui, fontSize: 11.5, marginTop: spacing.xs },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.code,
    fontSize: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filter: { flex: 0, marginBottom: spacing.sm },
  eye: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  eyeText: { color: colors.accent, fontFamily: fonts.uiMedium, fontSize: 12.5 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  primaryText: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 13.5 },
  disabled: { opacity: 0.5 },
  danger: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  dangerText: { color: colors.error, fontFamily: fonts.uiMedium, fontSize: 13 },
  ok: { color: colors.success, fontFamily: fonts.ui, fontSize: 12.5, marginTop: spacing.sm },
  err: { color: colors.error, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 19, marginTop: spacing.sm },
  selected: { color: colors.accent, fontFamily: fonts.code, fontSize: 12, marginBottom: spacing.sm },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  modelRowOn: { backgroundColor: colors.surfaceElevated },
  modelText: { flex: 1, color: colors.text, fontFamily: fonts.code, fontSize: 12.5 },
  startBtn: { marginTop: spacing.lg },
});