// src/components/GithubPullView.tsx
// شاشة سحب التغييرات من GitHub داخل نافذة GitHub: مراجعة الخطة، اختيار نسخة كل ملف
// متعارض، التقدم، والنتيجة.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { translate } from '../i18n/translate';
import type { TranslationKey } from '../i18n/translations';
import type { GithubPull } from '../github/useGithubPull';

interface Props {
  pull: GithubPull;
}

const MAX_CONFLICTS_LISTED = 40;
const MAX_SKIPPED_NAMES = 5;

export default function GithubPullView({ pull }: Props) {
  const { t } = useLanguage();
  const { ui, plan, choices, start, confirm, reset, setChoice, setAll } = pull;

  const pullingText = (): string => {
    if (ui.kind !== 'pulling' || !ui.progress) return t('ghl_planning');
    if (ui.progress.phase === 'apply') return t('ghl_pulling_apply');
    return translate('ghl_pulling_files', { done: ui.progress.done, total: ui.progress.total });
  };

  const errorText = (): string => {
    if (ui.kind !== 'error') return '';
    if (ui.code === 'need_login') return t('ghp_need_login');
    return t(`ghp_err_${ui.code}` as TranslationKey);
  };

  const skippedNote = (skipped: { path: string }[]): string =>
    translate('ghl_skipped_note', {
      count: skipped.length,
      names:
        skipped
          .slice(0, MAX_SKIPPED_NAMES)
          .map((s) => s.path)
          .join(', ') + (skipped.length > MAX_SKIPPED_NAMES ? ', ...' : ''),
    });

  return (
    <>
      {ui.kind === 'planning' && (
        <View style={styles.rowCenter}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>{t('ghl_planning')}</Text>
        </View>
      )}

      {ui.kind === 'review' && plan && (
        <>
          <Text style={styles.title}>{t('ghl_review_title')}</Text>
          <Text style={styles.summary}>
            {translate('ghl_summary', { writes: plan.writes.length, deletes: plan.deletes.length })}
          </Text>

          {plan.conflicts.length === 0 ? (
            <Text style={styles.muted}>{t('ghl_no_conflicts')}</Text>
          ) : (
            <>
              <Text style={styles.warnTitle}>{translate('ghl_conflicts_title', { count: plan.conflicts.length })}</Text>
              <Text style={styles.muted}>{t('ghl_conflicts_hint')}</Text>
              <View style={styles.bulkRow}>
                <TouchableOpacity style={styles.bulkBtn} onPress={() => setAll('mine')} activeOpacity={0.8}>
                  <Text style={styles.bulkText}>{t('ghl_all_mine')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bulkBtn} onPress={() => setAll('theirs')} activeOpacity={0.8}>
                  <Text style={styles.bulkText}>{t('ghl_all_theirs')}</Text>
                </TouchableOpacity>
              </View>
              {plan.conflicts.slice(0, MAX_CONFLICTS_LISTED).map((c) => {
                const choice = choices[c.path] ?? 'mine';
                return (
                  <View key={c.path} style={styles.conflict}>
                    <Text style={styles.path} numberOfLines={1}>
                      {c.path}
                    </Text>
                    {(c.remoteSha === null || c.localDeleted) && (
                      <Text style={styles.hint}>
                        {c.remoteSha === null ? t('ghl_deleted_remote') : t('ghl_deleted_local')}
                      </Text>
                    )}
                    <View style={styles.chips}>
                      <TouchableOpacity
                        style={[styles.chip, choice === 'mine' && styles.chipActive]}
                        onPress={() => setChoice(c.path, 'mine')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, choice === 'mine' && styles.chipTextActive]}>{t('ghl_mine')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chip, choice === 'theirs' && styles.chipActive]}
                        onPress={() => setChoice(c.path, 'theirs')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, choice === 'theirs' && styles.chipTextActive]}>
                          {t('ghl_theirs')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              {plan.conflicts.length > MAX_CONFLICTS_LISTED && (
                <Text style={styles.muted}>
                  {translate('ghl_more', { count: plan.conflicts.length - MAX_CONFLICTS_LISTED })}
                </Text>
              )}
            </>
          )}

          {plan.skipped.length > 0 && <Text style={styles.warn}>{skippedNote(plan.skipped)}</Text>}

          <TouchableOpacity style={styles.primaryBtn} onPress={() => void confirm()} activeOpacity={0.8}>
            <Text style={styles.primaryText}>{t('ghl_confirm')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={reset} activeOpacity={0.8}>
            <Text style={styles.secondaryText}>{t('ghl_cancel')}</Text>
          </TouchableOpacity>
        </>
      )}

      {ui.kind === 'pulling' && (
        <View style={styles.rowCenter}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>{pullingText()}</Text>
        </View>
      )}

      {ui.kind === 'done' && (
        <>
          <Text style={styles.success}>{translate('ghl_done', { written: ui.written, deleted: ui.deleted })}</Text>
          {ui.skipped.length > 0 && <Text style={styles.warn}>{skippedNote(ui.skipped)}</Text>}
          <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.8}>
            <Text style={styles.primaryText}>{t('ghl_back')}</Text>
          </TouchableOpacity>
        </>
      )}

      {ui.kind === 'error' && (
        <>
          <Text style={styles.error}>{errorText()}</Text>
          {ui.canRetry && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void start()} activeOpacity={0.8}>
              <Text style={styles.primaryText}>{t('ghs_retry')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={reset} activeOpacity={0.8}>
            <Text style={styles.secondaryText}>{t('ghl_back')}</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 15, marginBottom: spacing.xs },
  summary: { color: colors.text, fontFamily: fonts.ui, fontSize: 13, marginBottom: spacing.sm },
  warnTitle: { color: colors.warning, fontFamily: fonts.uiSemibold, fontSize: 13, marginBottom: spacing.xs },
  muted: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, marginBottom: spacing.sm },
  hint: { color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11, marginBottom: spacing.xs },
  success: { color: colors.success, fontFamily: fonts.uiSemibold, fontSize: 14, marginBottom: spacing.sm },
  warn: { color: colors.warning, fontFamily: fonts.ui, fontSize: 12, marginBottom: spacing.sm },
  error: { color: colors.error, fontFamily: fonts.ui, fontSize: 13, marginBottom: spacing.sm },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  bulkRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  bulkBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: 'center',
  },
  bulkText: { color: colors.textMuted, fontFamily: fonts.uiSemibold, fontSize: 12 },
  conflict: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  path: { color: colors.text, fontFamily: fonts.code, fontSize: 12, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontFamily: fonts.uiSemibold, fontSize: 12 },
  chipTextActive: { color: colors.accent },
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