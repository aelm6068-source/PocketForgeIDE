// src/screens/editor/EditorToolbar.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { FileIconBadge } from '../../theme/fileIcons';
import type { OpenFile } from './useEditorFile';

interface EditorToolbarProps {
  openFiles: OpenFile[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSearch: () => void;
  isSearchActive: boolean;
  onToggleWrap: () => void;
  isWrapped: boolean;
}

export default function EditorToolbar({
  openFiles,
  activeFileId,
  onSelectFile,
  onCloseFile,
  onBack,
  onUndo,
  onRedo,
  onToggleSearch,
  isSearchActive,
  onToggleWrap,
  isWrapped,
}: EditorToolbarProps) {
  const activeFile = openFiles.find((f) => f.id === activeFileId);

  return (
    <View>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1}>
          {activeFile?.name ?? 'المحرر'}
        </Text>

        <View style={styles.rightActions}>
          <TouchableOpacity
            style={[styles.iconBtn, isSearchActive && styles.iconBtnActive]}
            onPress={onToggleSearch}
          >
            <Ionicons name="search" size={17} color={isSearchActive ? colors.accent : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, isWrapped && styles.iconBtnActive]}
            onPress={onToggleWrap}
          >
            <Ionicons
              name="return-down-forward-outline"
              size={17}
              color={isWrapped ? colors.accent : colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onUndo}>
            <Ionicons name="arrow-undo" size={17} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onRedo}>
            <Ionicons name="arrow-redo" size={17} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {openFiles.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsRow}
          contentContainerStyle={styles.tabsContent}
        >
          {openFiles.map((file) => {
            const isActive = file.id === activeFileId;
            return (
              <TouchableOpacity
                key={file.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => onSelectFile(file.id)}
                activeOpacity={0.75}
              >
                <FileIconBadge fileName={file.name} />
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
                {file.isDirty && <View style={styles.dirtyDot} />}
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => onCloseFile(file.id)}
                >
                  <Ionicons name="close" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.displaySemibold,
    fontSize: 15,
    textAlign: 'center',
  },
  tabsRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsContent: {
    paddingHorizontal: spacing.md,
    gap: 6,
    paddingBottom: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 160,
  },
  tabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  tabText: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
    maxWidth: 90,
  },
  tabTextActive: {
    color: colors.text,
  },
  dirtyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
});