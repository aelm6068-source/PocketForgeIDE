// src/components/FileActionMenu.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../theme/colors';

export type FileActionTarget = {
  id: string;
  name: string;
  type: 'file' | 'folder';
};

type ActionKey =
  | 'rename'
  | 'copyPath'
  | 'duplicate'
  | 'download'
  | 'addFile'
  | 'addFolder'
  | 'delete';

interface FileActionMenuProps {
  visible: boolean;
  target: FileActionTarget | null;
  onClose: () => void;
  onAction: (action: ActionKey, target: FileActionTarget) => void;
}

const FILE_ACTIONS: { key: ActionKey; label: string; icon: string; destructive?: boolean }[] = [
  { key: 'rename', label: 'إعادة تسمية', icon: 'pencil-outline' },
  { key: 'copyPath', label: 'نسخ المسار', icon: 'copy-outline' },
  { key: 'duplicate', label: 'تكرار الملف', icon: 'duplicate-outline' },
  { key: 'download', label: 'تحميل', icon: 'download-outline' },
  { key: 'delete', label: 'حذف', icon: 'trash-outline', destructive: true },
];

const FOLDER_ACTIONS: { key: ActionKey; label: string; icon: string; destructive?: boolean }[] = [
  { key: 'rename', label: 'إعادة تسمية', icon: 'pencil-outline' },
  { key: 'addFile', label: 'إضافة ملف', icon: 'document-outline' },
  { key: 'addFolder', label: 'إضافة مجلد', icon: 'folder-outline' },
  { key: 'copyPath', label: 'نسخ المسار', icon: 'copy-outline' },
  { key: 'delete', label: 'حذف', icon: 'trash-outline', destructive: true },
];

export default function FileActionMenu({ visible, target, onClose, onAction }: FileActionMenuProps) {
  if (!target) return null;

  const actions = target.type === 'file' ? FILE_ACTIONS : FOLDER_ACTIONS;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Ionicons
              name={target.type === 'folder' ? 'folder' : 'document-outline'}
              size={16}
              color={colors.accent}
            />
            <Text style={styles.headerText} numberOfLines={1}>
              {target.name}
            </Text>
          </View>

          {actions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.row}
              onPress={() => onAction(action.key, target)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={action.icon as any}
                size={19}
                color={action.destructive ? colors.error : colors.text}
              />
              <Text
                style={[
                  styles.rowText,
                  action.destructive && { color: colors.error },
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: spacing.md,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    color: colors.textMuted,
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
  },
  rowText: {
    color: colors.text,
    fontFamily: fonts.uiMedium,
    fontSize: 15,
  },
});
