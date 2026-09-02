// src/components/RunSandboxModal.tsx
import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, Linking, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { RunProgressStage } from '../utils/daytonaClient';

interface Props {
  visible: boolean;
  stage: RunProgressStage | 'idle';
  message: string;
  tunnelUrl?: string;
  onClose: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  idle: 'جاري التجهيز...',
  installing: 'تثبيت الحزم',
  starting: 'تشغيل Expo',
  ready: 'جاهز',
  failed: 'فشل',
};

export default function RunSandboxModal({ visible, stage, message, tunnelUrl, onClose }: Props) {
  const isRunning = stage === 'idle' || stage === 'installing' || stage === 'starting';
  const isReady = stage === 'ready' && !!tunnelUrl;
  const isFailed = stage === 'failed';

  const handleCopy = async () => {
    if (!tunnelUrl) return;
    await Clipboard.setStringAsync(tunnelUrl);
    Alert.alert('تم', 'اتنسخ الرابط');
  };

  const handleOpen = () => {
    if (!tunnelUrl) return;
    Linking.openURL(tunnelUrl).catch(() => {
      Alert.alert('خطأ', 'مش قادر أفتح الرابط - انسخه وافتحه يدويًا في Expo Go');
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {isRunning && (
            <>
              <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: spacing.md }} />
              <Text style={styles.stageLabel}>{STAGE_LABELS[stage] ?? STAGE_LABELS.idle}</Text>
              <Text style={styles.message}>{message}</Text>
            </>
          )}

          {isReady && (
            <>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              </View>
              <Text style={styles.stageLabel}>التطبيق شغال</Text>
              <Text style={styles.urlText} numberOfLines={2}>{tunnelUrl}</Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
                  <Ionicons name="copy-outline" size={16} color={colors.text} />
                  <Text style={styles.actionBtnText}>نسخ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleOpen}>
                  <Ionicons name="open-outline" size={16} color="white" />
                  <Text style={[styles.actionBtnText, { color: 'white' }]}>فتح في Expo Go</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isFailed && (
            <>
              <Ionicons name="close-circle" size={40} color={colors.error} style={{ marginBottom: spacing.sm }} />
              <Text style={styles.stageLabel}>حصلت مشكلة</Text>
              <ScrollView style={styles.errorScroll}>
                <Text style={styles.message}>{message}</Text>
              </ScrollView>
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{isRunning ? 'إلغاء' : 'إغلاق'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  stageLabel: {
    color: colors.text,
    fontFamily: fonts.displaySemibold,
    fontSize: 17,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 13,
    textAlign: 'center',
  },
  errorScroll: {
    maxHeight: 220,
    width: '100%',
  },
  successIcon: { marginBottom: spacing.sm },
  urlText: {
    color: colors.accent,
    fontFamily: fonts.code,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  actionBtnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionBtnText: {
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 13,
  },
  closeBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  closeBtnText: {
    color: colors.textMuted,
    fontFamily: fonts.uiMedium,
    fontSize: 13,
  },
});
