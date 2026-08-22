// src/screens/editor/EditorActionBar.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import type { InfoModalKind } from './EditorInfoModal';

export type DiagnosticsStatus = 'checking' | 'clean' | 'warning' | 'error';

interface EditorActionBarProps {
  fileName: string;
  language: 'TypeScript' | 'JavaScript' | 'JSON' | 'Markdown' | 'Plain Text';
  status: DiagnosticsStatus;
  errorCount: number;
  warningCount: number;
  dirtyFilesCount: number;
  onOpenModal: (kind: InfoModalKind) => void;
}

export default function EditorActionBar({
  fileName,
  language,
  status,
  errorCount,
  warningCount,
  dirtyFilesCount,
  onOpenModal,
}: EditorActionBarProps) {
  const checkColor = status === 'checking' ? colors.textMuted : '#4ADE9C';

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Ionicons
          name={status === 'checking' ? 'sync-outline' : 'checkmark-circle'}
          size={15}
          color={checkColor}
        />
        <Text style={styles.langText}>{language}</Text>
        <View style={styles.dot} />
        <Text style={styles.fileText} numberOfLines={1}>{fileName}</Text>
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          style={styles.badge}
          onPress={() => onOpenModal('errors')}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle" size={14} color="#F25C5C" />
          <Text style={[styles.badgeText, { color: '#F25C5C' }]}>{errorCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.badge}
          onPress={() => onOpenModal('warnings')}
          activeOpacity={0.7}
        >
          <Ionicons name="warning" size={13} color="#F2B84C" />
          <Text style={[styles.badgeText, { color: '#F2B84C' }]}>{warningCount}</Text>
        </TouchableOpacity>

        {dirtyFilesCount > 0 && (
          <TouchableOpacity
            style={styles.badge}
            onPress={() => onOpenModal('dirtyFiles')}
            activeOpacity={0.7}
          >
            <View style={styles.dirtyDot} />
            <Text style={[styles.badgeText, { color: colors.accent }]}>{dirtyFilesCount}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.ui,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  fileText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.ui,
    maxWidth: 120,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.background,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontFamily: fonts.uiSemibold,
    fontSize: 11,
  },
  dirtyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
});