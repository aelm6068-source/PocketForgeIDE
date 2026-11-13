// src/components/ai/SlotsView.tsx
// شاشة الخانات والأدوار: ترتيب/تسمية/مسح الخانات، وإعادة تفعيل خانة منتظرة، وقواعد كل دور (تلقائي/يدوي).
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import type { useAiSlots } from '../../ai/useAiSlots';
import { MAX_SLOTS, SLOT_ROLES, type Slot, type SlotRole } from '../../ai/slots';
import InputModal from '../InputModal';

type Ai = ReturnType<typeof useAiSlots>;
interface Props {
  ai: Ai;
  onBack: () => void;
  onAddKey: () => void;
}

export default function SlotsView({ ai, onBack, onAddKey }: Props) {
  const { t } = useLanguage();
  const [renaming, setRenaming] = useState<Slot | null>(null);

  const move = (index: number, dir: -1 | 1) => {
    const ids = ai.slots.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void ai.reorder(ids);
  };

  const confirmDelete = (slot: Slot) => {
    Alert.alert(t('slots_delete'), t('slots_delete_confirm').split('{name}').join(slot.label), [
      { text: t('slots_cancel'), style: 'cancel' },
      { text: t('slots_delete_btn'), style: 'destructive', onPress: () => void ai.remove(slot.id) },
    ]);
  };

  const toggleInOrder = (role: SlotRole, order: string[], id: string) => {
    const next = order.includes(id) ? order.filter((x) => x !== id) : [...order, id];
    void ai.setRule(role, { mode: 'manual', order: next });
  };

  const full = ai.slots.length >= MAX_SLOTS;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('slots_title')}</Text>
          <TouchableOpacity onPress={onBack} style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.intro}>{t('slots_intro')}</Text>

        {ai.slots.length === 0 ? <Text style={styles.empty}>{t('slots_empty')}</Text> : null}
        {ai.slots.map((slot, i) => {
          const until = ai.busyUntil(slot.id);
          const secs = until ? Math.max(1, Math.ceil((until - Date.now()) / 1000)) : 0;
          return (
            <View key={slot.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardLabel} numberOfLines={1}>
                    {slot.label}
                  </Text>
                  <Text style={styles.cardModel} numberOfLines={1}>
                    {slot.provider} · {slot.model}
                  </Text>
                </View>
                <View style={styles.cardBtns}>
                  <TouchableOpacity onPress={() => move(i, -1)} disabled={i === 0} style={[styles.iconBtn, i === 0 && styles.off]}>
                    <Ionicons name="chevron-up" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => move(i, 1)}
                    disabled={i === ai.slots.length - 1}
                    style={[styles.iconBtn, i === ai.slots.length - 1 && styles.off]}
                  >
                    <Ionicons name="chevron-down" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setRenaming(slot)} style={styles.iconBtn}>
                    <Ionicons name="pencil" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(slot)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={17} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
              {secs > 0 ? (
                <TouchableOpacity onPress={() => ai.clearCooldown(slot.id)} activeOpacity={0.7}>
                  <Text style={styles.waiting}>
                    {t('slots_waiting').split('{s}').join(String(secs))} · {t('slots_reset')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.ready}>{t('slots_ready')}</Text>
              )}
            </View>
          );
        })}

        {full ? <Text style={styles.hint}>{t('slots_max').split('{n}').join(String(MAX_SLOTS))}</Text> : null}
        <TouchableOpacity style={[styles.addBtn, full && styles.off]} onPress={onAddKey} disabled={full} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color={colors.text} />
          <Text style={styles.addText}>{t('slots_add')}</Text>
        </TouchableOpacity>

        <Text style={[styles.title, styles.rolesTitle]}>{t('roles_title')}</Text>
        <Text style={styles.intro}>{t('roles_intro')}</Text>
        {SLOT_ROLES.map((role) => {
          const rule = ai.rules[role];
          const manual = rule.mode === 'manual';
          const order = rule.mode === 'manual' ? rule.order : [];
          return (
            <View key={role} style={styles.card}>
              <Text style={styles.cardLabel}>{t(`role_${role}` as TranslationKey)}</Text>
              <Text style={styles.cardModel}>{t(`role_${role}_desc` as TranslationKey)}</Text>
              <View style={styles.chips}>
                <TouchableOpacity
                  style={[styles.chip, !manual && styles.chipOn]}
                  onPress={() => void ai.setRule(role, { mode: 'auto' })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, !manual && styles.chipTextOn]}>{t('role_auto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, manual && styles.chipOn]}
                  onPress={() => void ai.setRule(role, { mode: 'manual', order: ai.slots.map((s) => s.id) })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, manual && styles.chipTextOn]}>{t('role_manual')}</Text>
                </TouchableOpacity>
              </View>
              {manual ? (
                <View>
                  <Text style={styles.hint}>{t('role_manual_hint')}</Text>
                  <View style={styles.chips}>
                    {ai.slots.map((s) => {
                      const pos = order.indexOf(s.id);
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.chip, pos >= 0 && styles.chipOn]}
                          onPress={() => toggleInOrder(role, order, s.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, pos >= 0 && styles.chipTextOn]} numberOfLines={1}>
                            {pos >= 0 ? `${pos + 1}. ` : ''}
                            {s.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {order.length === 0 ? <Text style={styles.warn}>{t('role_manual_empty')}</Text> : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <InputModal
        visible={!!renaming}
        title={t('slots_rename')}
        placeholder={t('slots_rename_placeholder')}
        initialValue={renaming?.label}
        submitLabel={t('slots_save')}
        onCancel={() => setRenaming(null)}
        onSubmit={(v) => {
          const slot = renaming;
          setRenaming(null);
          if (slot && v.trim()) void ai.update(slot.id, { label: v });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontFamily: fonts.displaySemibold, fontSize: 18 },
  rolesTitle: { marginTop: spacing.xl },
  iconBtn: { padding: spacing.xs },
  off: { opacity: 0.35 },
  intro: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 20, marginVertical: spacing.sm },
  empty: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 13, textAlign: 'center', marginVertical: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardInfo: { flex: 1 },
  cardBtns: { flexDirection: 'row', alignItems: 'center' },
  cardLabel: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 13.5 },
  cardModel: { color: colors.textMuted, fontFamily: fonts.code, fontSize: 11 },
  ready: { color: colors.success, fontFamily: fonts.ui, fontSize: 11.5 },
  waiting: { color: colors.warning, fontFamily: fonts.ui, fontSize: 11.5 },
  hint: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, lineHeight: 19, marginTop: spacing.sm },
  warn: { color: colors.warning, fontFamily: fonts.ui, fontSize: 12, lineHeight: 19, marginTop: spacing.sm },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  addText: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 13.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    maxWidth: '100%',
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipText: { color: colors.textMuted, fontFamily: fonts.uiMedium, fontSize: 12.5 },
  chipTextOn: { color: colors.text },
});
