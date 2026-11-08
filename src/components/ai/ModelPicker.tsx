// src/components/ai/ModelPicker.tsx
// اختيار الموديل: 3 عروض (الكل / للبرمجة / الموصى بيه) + "مجاني فقط" + بحث، ونتيجة اختبار الموديل.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ModelInfo, ProviderId } from '../../ai/providers';
import { hasFreeInfo, recommended, visibleModels } from '../../ai/modelFilters';
import type { ModelView } from '../../ai/modelFilters';
import type { ModelTest } from '../../ai/useAiSettings';

interface Props {
  provider: ProviderId;
  models: ModelInfo[];
  selected: string;
  test: ModelTest | null;
  view: ModelView;
  onView: (v: ModelView) => void;
  freeOnly: boolean;
  onFreeOnly: (v: boolean) => void;
  onChoose: (id: string) => void;
}

const MAX_SHOWN = 60;

export default function ModelPicker(p: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  const tags = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recommended(p.provider, p.models)) if (r.tag) map.set(r.model.id, r.tag);
    return map;
  }, [p.provider, p.models]);

  const list = useMemo(
    () => visibleModels(p.provider, p.models, p.view, p.freeOnly, query).slice(0, MAX_SHOWN),
    [p.provider, p.models, p.view, p.freeOnly, query]
  );

  const views: { id: ModelView; label: string }[] = [
    { id: 'recommended', label: t('ai_view_rec') },
    { id: 'coding', label: t('ai_view_coding') },
    { id: 'all', label: t('ai_view_all') },
  ];
  const note = p.view === 'coding' ? t('ai_view_note_coding') : p.view === 'recommended' ? t('ai_view_note_rec') : '';
  const mt = p.test;

  return (
    <View>
      <Text style={styles.label}>{t('ai_model_label')}</Text>
      {p.selected ? (
        <Text style={styles.selected}>
          {t('ai_model_selected')}: {p.selected}
        </Text>
      ) : null}

      <View style={styles.chips}>
        {views.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.chip, p.view === v.id && styles.chipOn]}
            onPress={() => p.onView(v.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, p.view === v.id && styles.chipTextOn]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
        {hasFreeInfo(p.models) ? (
          <TouchableOpacity
            style={[styles.chip, p.freeOnly && styles.chipFree]}
            onPress={() => p.onFreeOnly(!p.freeOnly)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, p.freeOnly && styles.chipTextOn]}>{t('ai_free_only')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}

      {mt ? (
        <Text
          style={[
            styles.status,
            mt.state === 'ok' && { color: colors.success },
            mt.state === 'rate' && { color: colors.warning },
            mt.state === 'fail' && { color: colors.error },
          ]}
        >
          {mt.state === 'testing' ? t('ai_mt_testing') : null}
          {mt.state === 'ok' ? t('ai_mt_ok') : null}
          {mt.state === 'rate' ? `${t('ai_mt_rate')} ${mt.message}` : null}
          {mt.state === 'fail' ? `${t('ai_mt_fail')} ${mt.message}` : null}
        </Text>
      ) : null}

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={t('ai_model_filter')}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />
      {list.length === 0 ? (
        <Text style={styles.note}>{p.view === 'recommended' && !query && !p.freeOnly ? t('ai_rec_empty') : t('ai_model_none')}</Text>
      ) : null}
      {list.map((m) => {
        const tag = tags.get(m.id);
        return (
          <TouchableOpacity
            key={m.id}
            style={[styles.row, m.id === p.selected && styles.rowOn]}
            onPress={() => p.onChoose(m.id)}
            activeOpacity={0.7}
          >
            <View style={styles.rowMain}>
              <Text style={styles.modelText} numberOfLines={1}>
                {m.id}
              </Text>
              <View style={styles.badges}>
                {tag ? <Text style={[styles.badge, styles.badgeTag]}>{tag}</Text> : null}
                {m.free === true ? <Text style={[styles.badge, styles.badgeFree]}>{t('ai_badge_free')}</Text> : null}
                {m.free === false ? <Text style={styles.badge}>{t('ai_badge_paid')}</Text> : null}
                {m.vision === true ? <Text style={styles.badge}>{t('ai_badge_vision')}</Text> : null}
                {m.tools === true ? <Text style={styles.badge}>{t('ai_badge_tools')}</Text> : null}
              </View>
            </View>
            {m.id === p.selected ? <Ionicons name="checkmark" size={16} color={colors.success} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.xs },
  selected: { color: colors.accent, fontFamily: fonts.code, fontSize: 12, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipFree: { borderColor: colors.success, backgroundColor: colors.surfaceElevated },
  chipText: { color: colors.textMuted, fontFamily: fonts.uiMedium, fontSize: 12 },
  chipTextOn: { color: colors.text },
  note: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 11.5, lineHeight: 18, marginTop: spacing.sm },
  status: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 19, marginTop: spacing.sm },
  input: {
    color: colors.text,
    fontFamily: fonts.code,
    fontSize: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  rowOn: { backgroundColor: colors.surfaceElevated },
  rowMain: { flex: 1 },
  modelText: { color: colors.text, fontFamily: fonts.code, fontSize: 12.5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginTop: 3 },
  badge: {
    color: colors.textMuted,
    fontFamily: fonts.uiMedium,
    fontSize: 10.5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeTag: { color: colors.accent, borderColor: colors.accent },
  badgeFree: { color: colors.success, borderColor: colors.success },
});