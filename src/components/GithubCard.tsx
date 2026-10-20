// src/components/GithubCard.tsx
// بطاقة ربط GitHub في شاشة الإعدادات (تسجيل دخول بالكود Device Flow)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { useGithubAuth } from '../github/useGithubAuth';
import { GITHUB_MANAGE_APPS_URL } from '../github/config';
import type { TranslationKey } from '../i18n/translations';
import { translate } from '../i18n/translate';

export default function GithubCard() {
  const { t } = useLanguage();
  const { status, account, device, error, connect, cancel, disconnect } = useGithubAuth();

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert(t('common_error'), t('github_open_error')));
  };

  const copyAndOpen = async () => {
    if (!device) return;
    try {
      await Clipboard.setStringAsync(device.userCode);
    } catch {
      // لو النسخ فشل المستخدم لسه يقدر يكتب الكود بإيده، فمنوقفش
    }
    openUrl(device.verificationUri);
  };

  const confirmDisconnect = () => {
    Alert.alert(t('github_disconnect_title'), t('github_disconnect_body'), [
      { text: t('github_cancel'), style: 'cancel' },
      { text: t('github_disconnect'), style: 'destructive', onPress: () => void disconnect() },
    ]);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('github_title')}</Text>
      <Text style={styles.hint}>{t('github_hint')}</Text>

      {status === 'loading' && (
        <View style={styles.rowCenter}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>{t('github_checking')}</Text>
        </View>
      )}

      {status === 'disconnected' && (
        <>
          <Text style={styles.note}>{t('github_permission_note')}</Text>
          {error && error !== 'cancelled' && (
            <Text style={styles.error}>{t(`github_err_${error}` as TranslationKey)}</Text>
          )}
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void connect()} activeOpacity={0.8}>
            <Text style={styles.primaryText}>{t('github_connect')}</Text>
          </TouchableOpacity>
        </>
      )}

      {status === 'pending' && (
        <>
          {device ? (
            <>
              <Text style={styles.label}>{t('github_code_title')}</Text>
              <Text style={styles.code} selectable>
                {device.userCode}
              </Text>
              <Text style={styles.note}>{t('github_code_steps')}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => void copyAndOpen()} activeOpacity={0.8}>
                <Text style={styles.primaryText}>{t('github_open_copy')}</Text>
              </TouchableOpacity>
              <View style={styles.rowCenter}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>{t('github_waiting')}</Text>
              </View>
            </>
          ) : (
            <View style={styles.rowCenter}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.muted}>{t('github_checking')}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={cancel} activeOpacity={0.8}>
            <Text style={styles.secondaryText}>{t('github_cancel')}</Text>
          </TouchableOpacity>
        </>
      )}

      {status === 'connected' && account && (
        <>
          <View style={styles.accountRow}>
            {account.avatarUrl ? <Image source={{ uri: account.avatarUrl }} style={styles.avatar} /> : null}
            <View style={styles.dot} />
            <Text style={styles.accountText} numberOfLines={1}>
              {translate('github_connected_as', { login: account.login })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => openUrl(GITHUB_MANAGE_APPS_URL)}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryText}>{t('github_manage')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerBtn} onPress={confirmDisconnect} activeOpacity={0.8}>
            <Text style={styles.dangerText}>{t('github_disconnect')}</Text>
          </TouchableOpacity>
        </>
      )}
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
  note: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.uiSemibold,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  code: {
    color: colors.text,
    fontFamily: fonts.codeBold,
    fontSize: 28,
    letterSpacing: 3,
    textAlign: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.error,
    fontFamily: fonts.ui,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  muted: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  accountText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryText: {
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 14,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  secondaryText: {
    color: colors.textMuted,
    fontFamily: fonts.uiSemibold,
    fontSize: 13,
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  dangerText: {
    color: colors.error,
    fontFamily: fonts.uiSemibold,
    fontSize: 13,
  },
});