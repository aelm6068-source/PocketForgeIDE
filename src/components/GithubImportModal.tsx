// src/components/GithubImportModal.tsx
// نافذة "استيراد من GitHub": قايمة مستودعات حسابك مع بحث، واختيار مستودع بينشئ منه مشروع جديد.
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { translate } from '../i18n/translate';
import type { TranslationKey } from '../i18n/translations';
import { useGithubImport, MAX_LISTED_REPOS } from '../github/useGithubImport';
import type { ImportedProject } from '../github/useGithubImport';

interface Props {
  visible: boolean;
  // المشروع اتحفظ: ضيفه لقايمة المشاريع
  onImported: (project: ImportedProject) => void;
  // المستخدم ضغط "فتح المشروع"
  onOpen: (project: ImportedProject) => void;
  onClose: () => void;
}

const MAX_SKIPPED_NAMES = 5;

export default function GithubImportModal({ visible, onImported, onOpen, onClose }: Props) {
  const { t } = useLanguage();
  const { ui, filtered, repos, query, setQuery, pick, retry, backToList } = useGithubImport(visible, onImported);

  const busy = ui.kind === 'importing';

  const importingText = (): string => {
    if (ui.kind !== 'importing' || !ui.progress) return t('ghi_importing_tree');
    const p = ui.progress;
    if (p.phase === 'tree') return t('ghi_importing_tree');
    if (p.phase === 'apply') return t('ghi_importing_apply');
    return translate('ghi_importing_files', { done: p.done, total: p.total });
  };

  const errorText = (): string => {
    if (ui.kind !== 'error') return '';
    if (ui.code === 'need_login') return t('ghp_need_login');
    if (ui.code === 'repo_empty') return t('ghi_err_repo_empty');
    if (ui.code === 'no_files') return t('ghi_err_no_files');
    if (ui.code === 'too_big') return t('ghi_err_too_big');
    return t(`ghp_err_${ui.code}` as TranslationKey);
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
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
          <Text style={styles.title}>{t('ghi_title')}</Text>

          {ui.kind === 'loading' && (
            <View style={styles.rowCenter}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.muted}>{t('ghi_loading')}</Text>
            </View>
          )}

          {ui.kind === 'list' && (
            <>
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder={t('ghi_search')}
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {repos.length === 0 && <Text style={styles.muted}>{t('ghi_empty_list')}</Text>}
                {repos.length > 0 && filtered.length === 0 && <Text style={styles.muted}>{t('ghi_no_match')}</Text>}
                {filtered.slice(0, MAX_LISTED_REPOS).map((r) => (
                  <TouchableOpacity
                    key={`${r.owner}/${r.name}`}
                    style={styles.repoRow}
                    onPress={() => void pick(r)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.repoHead}>
                      <Text style={styles.repoName} numberOfLines={1}>{`${r.owner}/${r.name}`}</Text>
                      {r.isPrivate && (
                        <View style={styles.badge}>
                          <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
                          <Text style={styles.badgeText}>{t('ghi_private')}</Text>
                        </View>
                      )}
                    </View>
                    {r.description ? (
                      <Text style={styles.repoDesc} numberOfLines={1}>
                        {r.description}
                      </Text>
                    ) : null}
                    {r.pushedAt ? <Text style={styles.repoDate}>{formatDate(r.pushedAt)}</Text> : null}
                  </TouchableOpacity>
                ))}
                {filtered.length > MAX_LISTED_REPOS && (
                  <Text style={styles.muted}>{translate('ghi_more', { count: MAX_LISTED_REPOS })}</Text>
                )}
              </ScrollView>
              {closeBtn}
            </>
          )}

          {ui.kind === 'importing' && (
            <>
              <Text style={styles.repoName}>{ui.repo}</Text>
              <View style={styles.rowCenter}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>{importingText()}</Text>
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
              <Text style={styles.error}>{errorText()}</Text>
              {ui.canRetry && (
                <TouchableOpacity style={styles.primaryBtn} onPress={retry} activeOpacity={0.8}>
                  <Text style={styles.primaryText}>{t('ghs_retry')}</Text>
                </TouchableOpacity>
              )}
              {ui.stage === 'import' && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={backToList} activeOpacity={0.8}>
                  <Text style={styles.secondaryText}>{t('ghl_back')}</Text>
                </TouchableOpacity>
              )}
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
    maxHeight: '85%',
  },
  title: { color: colors.text, fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, marginBottom: spacing.sm },
  success: { color: colors.success, fontFamily: fonts.uiSemibold, fontSize: 15, marginBottom: spacing.sm },
  warn: { color: colors.warning, fontFamily: fonts.ui, fontSize: 12, marginBottom: spacing.sm },
  error: { color: colors.error, fontFamily: fonts.ui, fontSize: 13, marginBottom: spacing.sm },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  list: { flexGrow: 0, maxHeight: 380, marginBottom: spacing.sm },
  repoRow: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  repoHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  repoName: { flex: 1, color: colors.text, fontFamily: fonts.codeMedium, fontSize: 13 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badgeText: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 11 },
  repoDesc: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, marginTop: 2 },
  repoDate: { color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11, marginTop: 2 },
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