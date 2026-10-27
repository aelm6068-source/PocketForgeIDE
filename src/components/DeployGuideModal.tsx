// src/components/DeployGuideModal.tsx
// قسم "النشر والبناء": كروت قابلة للفتح لكل منصة (خطوات، حدود مجانية، أوامر للنسخ، روابط رسمية).
// البيانات في src/deploy/guides.ts والنصوص في src/i18n/deploy.ts.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { translate } from '../i18n/translate';
import type { TranslationKey } from '../i18n/translations';
import { DEPLOY_CHECKED_ON, DEPLOY_GUIDES } from '../deploy/guides';
import type { DeployGroup, DeployGuide } from '../deploy/guides';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const GROUPS: { id: DeployGroup; titleKey: string }[] = [
  { id: 'site', titleKey: 'dpl_group_site' },
  { id: 'app', titleKey: 'dpl_group_app' },
];

export default function DeployGuideModal({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tk = (key: string): string => t(key as TranslationKey);

  useEffect(() => {
    if (!visible) setOpenId(null);
  }, [visible]);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  const copy = async (id: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedId(id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // النسخ فشل: المستخدم يقدر يحدد النص ويعمل نسخ بإيده (النص قابل للتحديد)
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert(t('common_error'), t('dpl_link_error')));
  };

  const roleColor = (role: DeployGuide['role']): string =>
    role === 'primary' ? colors.success : role === 'backup' ? colors.textMuted : colors.warning;

  const renderGuide = (g: DeployGuide) => {
    const open = openId === g.id;
    return (
      <View key={g.id} style={styles.card}>
        <TouchableOpacity style={styles.cardHead} onPress={() => setOpenId(open ? null : g.id)} activeOpacity={0.8}>
          <View style={styles.cardHeadText}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{tk(g.titleKey)}</Text>
              <Text style={[styles.role, { color: roleColor(g.role) }]}>{tk(`dpl_role_${g.role}`)}</Text>
            </View>
            <Text style={styles.summary}>{tk(g.summaryKey)}</Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {open && (
          <View style={styles.body}>
            {g.noteKeys.map((k) => (
              <Text key={k} style={styles.note}>
                {tk(k)}
              </Text>
            ))}

            <Text style={styles.sectionLabel}>{t('dpl_steps')}</Text>
            {g.stepKeys.map((k, i) => (
              <View key={k} style={styles.stepRow}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <Text style={styles.stepText}>{tk(k)}</Text>
              </View>
            ))}

            {g.snippets.map((s) => (
              <View key={s.id} style={styles.snippet}>
                <View style={styles.snippetHead}>
                  <Text style={styles.snippetLabel}>{tk(s.labelKey)}</Text>
                  <TouchableOpacity onPress={() => void copy(s.id, s.text)} activeOpacity={0.8}>
                    <Text style={styles.copyText}>{copiedId === s.id ? t('dpl_copied') : t('dpl_copy')}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.code} selectable>
                  {s.text}
                </Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>{t('dpl_limits')}</Text>
            {g.limitKeys.map((k) => (
              <Text key={k} style={styles.limit}>
                {'• ' + tk(k)}
              </Text>
            ))}

            <View style={styles.links}>
              {g.links.map((l) => (
                <TouchableOpacity key={l.url} style={styles.linkBtn} onPress={() => openLink(l.url)} activeOpacity={0.8}>
                  <Ionicons name="open-outline" size={14} color={colors.accent} />
                  <Text style={styles.linkText}>{tk(l.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayPress} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('dpl_title')}</Text>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>{t('dpl_intro')}</Text>
            {GROUPS.map((grp) => (
              <View key={grp.id}>
                <Text style={styles.groupTitle}>{tk(grp.titleKey)}</Text>
                {DEPLOY_GUIDES.filter((g) => g.group === grp.id).map(renderGuide)}
              </View>
            ))}
            <Text style={styles.checked}>{translate('dpl_checked', { date: DEPLOY_CHECKED_ON })}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>{t('ghi_close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayPress: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    maxHeight: '90%',
  },
  title: { color: colors.text, fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: spacing.sm },
  scroll: { flexGrow: 0 },
  intro: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 20, marginBottom: spacing.sm },
  groupTitle: {
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 14,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  cardHeadText: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cardTitle: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 14 },
  role: { fontFamily: fonts.uiMedium, fontSize: 11 },
  summary: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, marginTop: 2, lineHeight: 18 },
  body: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  note: {
    color: colors.warning,
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontFamily: fonts.uiSemibold,
    fontSize: 12,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  stepNum: { color: colors.accent, fontFamily: fonts.codeBold, fontSize: 12, width: 16 },
  stepText: { flex: 1, color: colors.text, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 20 },
  snippet: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  snippetHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  snippetLabel: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 11, flex: 1 },
  copyText: { color: colors.accent, fontFamily: fonts.uiSemibold, fontSize: 12 },
  code: { color: colors.text, fontFamily: fonts.code, fontSize: 11.5, textAlign: 'left', writingDirection: 'ltr' },
  limit: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, lineHeight: 19 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  linkText: { color: colors.accent, fontFamily: fonts.uiMedium, fontSize: 12 },
  checked: { color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11, lineHeight: 17, marginVertical: spacing.sm },
  closeBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  closeText: { color: colors.textMuted, fontFamily: fonts.uiSemibold, fontSize: 13 },
});