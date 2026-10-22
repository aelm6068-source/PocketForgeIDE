// src/components/GithubSyncPanel.tsx
// لوحة التحديث داخل نافذة GitHub لمشروع مربوط بمستودع: بتعرض التغييرات من آخر رفع
// (جديد / معدّل / محذوف) وبترفعها في commit جديد برسالة من المستخدم.
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { translate } from '../i18n/translate';
import type { TranslationKey } from '../i18n/translations';
import type { GithubLink } from '../github/linkStore';
import { useGithubSync } from '../github/useGithubSync';

interface Props {
  visible: boolean;
  projectId: string;
  link: GithubLink;
  onClose: () => void;
}

const MAX_LISTED = 40;

type Row = { mark: '+' | '~' | '-'; path: string };

export default function GithubSyncPanel({ visible, projectId, link: initialLink, onClose }: Props) {
  const { t } = useLanguage();
  const { ui, link, changes, message, setMessage, remoteAhead, push, reload } = useGithubSync(
    visible,
    projectId,
    initialLink
  );

  const openRepo = () => {
    Linking.openURL(link.htmlUrl).catch(() => Alert.alert(t('common_error'), t('ghs_open_error')));
  };

  const rows: Row[] = changes
    ? [
        ...changes.added.map((e): Row => ({ mark: '+', path: e.path })),
        ...changes.modified.map((e): Row => ({ mark: '~', path: e.path })),
        ...changes.deleted.map((p): Row => ({ mark: '-', path: p })),
      ]
    : [];

  const pushingText = (): string => {
    if (ui.kind !== 'pushing' || !ui.progress) return t('ghs_pushing_check');
    const p = ui.progress;
    if (p.phase === 'check') return t('ghs_pushing_check');
    if (p.phase === 'commit') return t('ghs_pushing_commit');
    return translate('ghs_pushing_files', { done: p.done, total: p.total });
  };

  const errorText = (): string => {
    if (ui.kind !== 'error') return '';
    if (ui.code === 'need_login') return t('ghp_need_login');
    return t(`ghp_err_${ui.code}` as TranslationKey);
  };

  const markColor = (m: Row['mark']): string =>
    m === '+' ? colors.success : m === '~' ? colors.warning : colors.error;

  return (
    <>
      <Text style={styles.label}>{t('ghs_repo_label')}</Text>
      <TouchableOpacity onPress={openRepo} activeOpacity={0.7}>
        <Text style={styles.repo}>{`${link.owner}/${link.repo}`}</Text>
      </TouchableOpacity>

      {ui.kind === 'checking' && (
        <View style={styles.rowCenter}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>{t('ghs_checking')}</Text>
        </View>
      )}

      {ui.kind === 'clean' && <Text style={styles.success}>{t('ghs_clean')}</Text>}

      {ui.kind === 'changes' && changes && (
        <>
          <Text style={styles.summary}>
            {translate('ghs_summary', {
              added: changes.added.length,
              modified: changes.modified.length,
              deleted: changes.deleted.length,
            })}
          </Text>
          <View style={styles.list}>
            {rows.slice(0, MAX_LISTED).map((r) => (
              <View key={`${r.mark}${r.path}`} style={styles.row}>
                <Text style={[styles.mark, { color: markColor(r.mark) }]}>{r.mark}</Text>
                <Text style={styles.path} numberOfLines={1}>
                  {r.path}
                </Text>
              </View>
            ))}
            {rows.length > MAX_LISTED && (
              <Text style={styles.muted}>{translate('ghs_more', { count: rows.length - MAX_LISTED })}</Text>
            )}
          </View>

          <Text style={styles.label}>{t('ghs_message_label')}</Text>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            autoCorrect={false}
            placeholderTextColor={colors.textFaint}
          />
        </>
      )}

      {ui.kind === 'pushing' && (
        <View style={styles.rowCenter}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>{pushingText()}</Text>
        </View>
      )}

      {ui.kind === 'pushed' && <Text style={styles.success}>{t('ghs_pushed')}</Text>}

      {ui.kind === 'error' && <Text style={styles.error}>{errorText()}</Text>}

      {remoteAhead && ui.kind !== 'pushing' && <Text style={styles.warn}>{t('ghs_remote_ahead')}</Text>}

      {ui.kind === 'changes' && (
        <TouchableOpacity
          style={[styles.primaryBtn, remoteAhead && styles.disabledBtn]}
          onPress={() => void push()}
          disabled={remoteAhead}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryText}>{t('ghs_push')}</Text>
        </TouchableOpacity>
      )}

      {ui.kind === 'error' && ui.canRetry && (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => void reload()} activeOpacity={0.8}>
          <Text style={styles.primaryText}>{t('ghs_retry')}</Text>
        </TouchableOpacity>
      )}

      {(ui.kind === 'pushed' || ui.kind === 'clean') && (
        <TouchableOpacity style={styles.primaryBtn} onPress={openRepo} activeOpacity={0.8}>
          <Text style={styles.primaryText}>{t('ghs_open_github')}</Text>
        </TouchableOpacity>
      )}

      {ui.kind !== 'pushing' && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.secondaryText}>{t('ghs_close')}</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontFamily: fonts.uiSemibold, fontSize: 13, marginBottom: spacing.xs },
  repo: { color: colors.text, fontFamily: fonts.codeMedium, fontSize: 14, marginBottom: spacing.sm },
  summary: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 13, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, marginBottom: spacing.sm },
  success: { color: colors.success, fontFamily: fonts.uiSemibold, fontSize: 14, marginBottom: spacing.sm },
  warn: { color: colors.warning, fontFamily: fonts.ui, fontSize: 12, marginBottom: spacing.sm },
  error: { color: colors.error, fontFamily: fonts.ui, fontSize: 13, marginBottom: spacing.sm },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  list: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  mark: { fontFamily: fonts.codeBold, fontSize: 14, width: 14, textAlign: 'center' },
  path: { flex: 1, color: colors.text, fontFamily: fonts.code, fontSize: 12 },
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
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  disabledBtn: { opacity: 0.4 },
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