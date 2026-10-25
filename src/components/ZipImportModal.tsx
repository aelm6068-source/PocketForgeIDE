// src/components/ZipImportModal.tsx
// نافذة تقدّم "استيراد من ZIP": بتظهر بعد ما المستخدم يختار الملف (قبلها المنتقي بس).
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { translate } from '../i18n/translate';
import type { TranslationKey } from '../i18n/translations';
import type { ZipUi } from '../github/useZipImport';
import type { ImportedProject } from '../github/useGithubImport';

interface Props {
  ui: ZipUi;
  onOpen: (project: ImportedProject) => void;
  onClose: () => void;
}

const MAX_SKIPPED_NAMES = 5;

export default function ZipImportModal({ ui, onOpen, onClose }: Props) {
  const { t } = useLanguage();
  // أثناء اختيار الملف مفيش نافذة (المنتقي هو اللي ظاهر)
  const visible = ui.kind !== 'idle' && ui.kind !== 'picking';
  const busy = ui.kind === 'reading' || ui.kind === 'working';

  const workingText = (): string => {
    if (ui.kind !== 'working' || !ui.progress) return t('zip_reading');
    const p = ui.progress;
    if (p.phase === 'apply') return t('zip_importing');
    return translate('zip_extracting', { done: p.done, total: p.total });
  };

  const closeBtn = (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.8}>
      <Text style={styles.secondaryText}>{t('ghi_close')}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayPress} onPress={busy ? undefined : onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('zip_title')}</Text>

          {(ui.kind === 'reading' || ui.kind === 'working') && (
            <>
              <Text style={styles.fileName} numberOfLines={1}>
                {ui.file}
              </Text>
              <View style={styles.rowCenter}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>{ui.kind === 'reading' ? t('zip_reading') : workingText()}</Text>
              </View>
            </>
          )}

          {ui.kind === 'done' && (
            <>
              <Text style={styles.success}>{translate('ghi_done', { count: ui.fileCount })}</Text>
              {ui.skipped.length > 0 && (
                <Text style={styles.warn}>
                  {translate('ghl_skipped_note', {
                    count: ui.skipped.length,
                    names:
                      ui.skipped
                        .slice(0, MAX_SKIPPED_NAMES)
                        .map((s) => s.path)
                        .join(', ') + (ui.skipped.length > MAX_SKIPPED_NAMES ? ', ...' : ''),
                  })}
                </Text>
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={() => onOpen(ui.project)} activeOpacity={0.8}>
                <Text style={styles.primaryText}>{t('ghi_open_project')}</Text>
              </TouchableOpacity>
              {closeBtn}
            </>
          )}

          {ui.kind === 'error' && (
            <>
              <Text style={styles.error}>{t(`zip_err_${ui.code}` as TranslationKey)}</Text>
              {closeBtn}
            </>
          )}
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
  },
  title: { color: colors.text, fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: spacing.sm },
  fileName: { color: colors.text, fontFamily: fonts.codeMedium, fontSize: 13 },
  muted: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12 },
  success: { color: colors.success, fontFamily: fonts.uiSemibold, fontSize: 15, marginBottom: spacing.sm },
  warn: { color: colors.warning, fontFamily: fonts.ui, fontSize: 12, marginBottom: spacing.sm },
  error: { color: colors.error, fontFamily: fonts.ui, fontSize: 13, marginBottom: spacing.sm },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryText: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 14 },
  secondaryBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  secondaryText: { color: colors.textMuted, fontFamily: fonts.uiSemibold, fontSize: 13 },
});