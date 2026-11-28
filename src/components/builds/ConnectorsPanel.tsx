// src/components/builds/ConnectorsPanel.tsx
// تاب الموصّلات: حاليًا بناء APK عبر GitHub Actions (تجهيز، تشغيل، متابعة، تنزيل).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { useBuilds, type RunView } from '../../builds/useBuilds';

const MB = 1024 * 1024;
const STATE_COLOR: Record<string, string> = {
  queued: colors.textMuted,
  running: '#E0A33A',
  success: '#3DDC97',
  failed: '#E5566D',
  cancelled: colors.textMuted,
};

interface Props {
  projectId: string;
  active: boolean;
}

export default function ConnectorsPanel({ projectId, active }: Props) {
  const { t } = useLanguage();
  const b = useBuilds(projectId, active);
  const [copied, setCopied] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const open = (url: string) => void Linking.openURL(url).catch(() => {});
  const copyError = async (r: RunView) => {
    const text = t('conn_error_text').replace('{n}', String(r.number)).replace('{step}', r.failedStep ?? '?').replace('{url}', r.htmlUrl);
    await Clipboard.setStringAsync(text);
    setCopied(r.id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1500);
  };
  const errText = b.error ? t(`conn_err_${b.error.code}` as TranslationKey) : '';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('conn_builds_title')}</Text>
        <Text style={styles.hint}>{t('conn_builds_hint')}</Text>

        {b.status === 'loading' ? <ActivityIndicator color={colors.accent} style={styles.gap} /> : null}
        {b.status === 'no_token' ? <Text style={styles.warn}>{t('conn_no_token')}</Text> : null}
        {b.status === 'no_link' ? <Text style={styles.warn}>{t('conn_no_link')}</Text> : null}

        {b.status === 'ready' && b.link ? (
          <>
            <Text style={styles.repo}>{t('conn_repo').replace('{repo}', `${b.link.owner}/${b.link.repo}`)}</Text>
            {!b.hasWorkflow ? (
              <>
                <Text style={styles.hint}>{t('conn_setup_hint')}</Text>
                <TouchableOpacity style={[styles.btn, b.busy && styles.off]} disabled={b.busy} onPress={() => void b.setup()} activeOpacity={0.8}>
                  <Text style={styles.btnText}>{t('conn_setup')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, (b.busy || b.running) && styles.off]} disabled={b.busy || b.running} onPress={() => void b.build()} activeOpacity={0.8}>
                  <Text style={styles.btnText}>{t('conn_build')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGhost} disabled={b.busy} onPress={() => void b.refresh()} activeOpacity={0.8}>
                  <Text style={styles.btnText}>{t('conn_refresh')}</Text>
                </TouchableOpacity>
                {b.busy || b.running ? <ActivityIndicator color={colors.accent} /> : null}
              </View>
            )}
          </>
        ) : null}
        {errText ? <Text style={styles.err}>{errText}</Text> : null}
      </View>

      {b.status === 'ready' && b.hasWorkflow ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t('conn_runs')}</Text>
          {b.runs.length === 0 ? <Text style={styles.hint}>{t('conn_no_runs')}</Text> : null}
          {b.runs.map((r) => (
            <View key={r.id} style={styles.run}>
              <View style={styles.runHead}>
                <Text style={styles.runNum}>#{r.number}</Text>
                <Text style={[styles.state, { color: STATE_COLOR[r.state] }]}>{t(`conn_state_${r.state}` as TranslationKey)}</Text>
                <Text style={styles.time}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</Text>
              </View>
              {r.state === 'failed' && r.failedStep ? <Text style={styles.err}>{t('conn_failed_step').replace('{step}', r.failedStep)}</Text> : null}
              <View style={styles.row}>
                {r.state === 'success' && r.apk?.downloadUrl ? (
                  <TouchableOpacity style={styles.btn} onPress={() => open(r.apk!.downloadUrl!)} activeOpacity={0.8}>
                    <Text style={styles.btnText}>
                      {t('conn_download')}
                      {r.apk.size ? ` (${(r.apk.size / MB).toFixed(0)} MB)` : ''}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {r.state === 'success' && r.apk ? (
                  <TouchableOpacity style={styles.btnGhost} onPress={() => open(r.apk!.releaseUrl)} activeOpacity={0.8}>
                    <Text style={styles.btnText}>{t('conn_open_release')}</Text>
                  </TouchableOpacity>
                ) : null}
                {r.state === 'failed' ? (
                  <TouchableOpacity style={styles.btnGhost} onPress={() => void copyError(r)} activeOpacity={0.8}>
                    <Text style={styles.btnText}>{copied === r.id ? t('conn_copied') : t('conn_copy_error')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.btnGhost} onPress={() => open(r.htmlUrl)} activeOpacity={0.8}>
                  <Text style={styles.btnText}>{t('conn_open_run')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.uiMedium, fontSize: 15 },
  hint: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, lineHeight: 18 },
  warn: { color: '#E0A33A', fontFamily: fonts.ui, fontSize: 13, lineHeight: 19 },
  err: { color: '#E5566D', fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 18 },
  repo: { color: colors.text, fontFamily: fonts.code, fontSize: 12, textAlign: 'left' },
  gap: { marginTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  btn: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent },
  btnGhost: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  off: { opacity: 0.45 },
  btnText: { color: colors.text, fontFamily: fonts.uiMedium, fontSize: 12 },
  run: { gap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  runHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  runNum: { color: colors.text, fontFamily: fonts.code, fontSize: 13 },
  state: { fontFamily: fonts.uiMedium, fontSize: 12 },
  time: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 11, flex: 1, textAlign: 'right' },
});
