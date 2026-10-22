// src/components/GithubPublishModal.tsx
// نافذة "رفع إلى GitHub": تنشئ مستودعًا للمشروع وترفع ملفاته (أول رفع)
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
  Linking,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { translate } from '../i18n/translate';
import type { TranslationKey } from '../i18n/translations';
import { usePublish } from '../github/usePublish';
import GithubSyncPanel from './GithubSyncPanel';

interface Props {
  visible: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GithubPublishModal({ visible, projectId, projectName, onClose }: Props) {
  const { t } = useLanguage();
  const { ui, snapshot, name, changeName, isPrivate, setIsPrivate, nameError, submit } = usePublish(
    visible,
    projectId,
    projectName
  );

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert(t('common_error'), t('ghp_open_error')));
  };

  const secretFiles = snapshot ? snapshot.skipped.filter((s) => s.reason === 'secret' || s.reason === 'secret_content') : [];
  const otherSkipped = snapshot
    ? snapshot.skipped.filter((s) => s.reason !== 'ignored' && s.reason !== 'secret' && s.reason !== 'secret_content')
    : [];

  const workingText = (): string => {
    if (ui.kind !== 'working' || !ui.progress) return t('ghp_working_repo');
    const p = ui.progress;
    if (p.phase === 'repo') return t('ghp_working_repo');
    if (p.phase === 'commit') return t('ghp_working_commit');
    return translate('ghp_working_files', { done: p.done, total: p.total });
  };

  const closeBtn = (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.8}>
      <Text style={styles.secondaryText}>{t('ghp_close')}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={styles.overlayPress} onPress={ui.kind === 'working' ? undefined : onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('ghp_title')}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            {ui.kind === 'checking' && (
              <View style={styles.rowCenter}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>{t('ghp_checking')}</Text>
              </View>
            )}

            {ui.kind === 'need_login' && (
              <>
                <Text style={styles.body}>{t('ghp_need_login')}</Text>
                {closeBtn}
              </>
            )}

            {ui.kind === 'empty' && (
              <>
                <Text style={styles.body}>{t('ghp_empty')}</Text>
                {closeBtn}
              </>
            )}

            {ui.kind === 'linked' && (
              <GithubSyncPanel visible={visible} projectId={projectId} link={ui.link} onClose={onClose} />
            )}

            {ui.kind === 'form' && snapshot && (
              <>
                <Text style={styles.muted}>
                  {translate('ghp_summary', { count: snapshot.entries.length, size: formatBytes(snapshot.totalBytes) })}
                </Text>
                {secretFiles.length > 0 && (
                  <Text style={styles.warn}>
                    {translate('ghp_secrets_note', {
                      count: secretFiles.length,
                      names: secretFiles.map((s) => s.path).join(', '),
                    })}
                  </Text>
                )}
                {otherSkipped.length > 0 && (
                  <Text style={styles.warn}>{translate('ghp_skipped_note', { count: otherSkipped.length })}</Text>
                )}

                <Text style={styles.label}>{t('ghp_name_label')}</Text>
                <TextInput
                  style={[styles.input, nameError ? styles.inputError : null]}
                  value={name}
                  onChangeText={changeName}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={colors.textFaint}
                />
                {nameError ? (
                  <Text style={styles.error}>{t(`ghp_name_${nameError}` as TranslationKey)}</Text>
                ) : (
                  <Text style={styles.hint}>{t('ghp_name_hint')}</Text>
                )}

                <View style={styles.chips}>
                  <TouchableOpacity
                    style={[styles.chip, isPrivate && styles.chipActive]}
                    onPress={() => setIsPrivate(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, isPrivate && styles.chipTextActive]}>{t('ghp_private')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chip, !isPrivate && styles.chipActive]}
                    onPress={() => setIsPrivate(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, !isPrivate && styles.chipTextActive]}>{t('ghp_public')}</Text>
                  </TouchableOpacity>
                </View>
                {!isPrivate && <Text style={styles.warn}>{t('ghp_public_warning')}</Text>}

                <TouchableOpacity style={styles.primaryBtn} onPress={() => void submit()} activeOpacity={0.8}>
                  <Text style={styles.primaryText}>{t('ghp_submit')}</Text>
                </TouchableOpacity>
                {closeBtn}
              </>
            )}

            {ui.kind === 'working' && (
              <View style={styles.rowCenter}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>{workingText()}</Text>
              </View>
            )}

            {ui.kind === 'done' && (
              <>
                <Text style={styles.success}>{t('ghp_done_title')}</Text>
                <Text style={styles.repo}>{`${ui.link.owner}/${ui.link.repo}`}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => openUrl(ui.link.htmlUrl)} activeOpacity={0.8}>
                  <Text style={styles.primaryText}>{t('ghp_open_github')}</Text>
                </TouchableOpacity>
                {closeBtn}
              </>
            )}

            {ui.kind === 'error' && (
              <>
                <Text style={styles.error}>{t(`ghp_err_${ui.code}` as TranslationKey)}</Text>
                {ui.canRetry && (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => void submit()} activeOpacity={0.8}>
                    <Text style={styles.primaryText}>{t('ghp_retry')}</Text>
                  </TouchableOpacity>
                )}
                {closeBtn}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  scroll: { flexGrow: 0 },
  title: {
    color: colors.text,
    fontFamily: fonts.displaySemibold,
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  body: { color: colors.text, fontFamily: fonts.ui, fontSize: 14, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, marginBottom: spacing.sm },
  hint: { color: colors.textFaint, fontFamily: fonts.ui, fontSize: 11, marginBottom: spacing.sm },
  warn: { color: colors.warning, fontFamily: fonts.ui, fontSize: 12, marginBottom: spacing.sm },
  error: { color: colors.error, fontFamily: fonts.ui, fontSize: 13, marginBottom: spacing.sm },
  success: { color: colors.success, fontFamily: fonts.uiSemibold, fontSize: 15, marginBottom: spacing.xs },
  repo: { color: colors.text, fontFamily: fonts.codeMedium, fontSize: 14, marginBottom: spacing.sm },
  label: { color: colors.textMuted, fontFamily: fonts.uiSemibold, fontSize: 13, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontFamily: fonts.code,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.xs,
  },
  inputError: { borderColor: colors.error },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontFamily: fonts.uiSemibold, fontSize: 13 },
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