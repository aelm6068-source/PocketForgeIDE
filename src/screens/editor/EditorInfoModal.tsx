// src/screens/editor/EditorInfoModal.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { FileIconBadge } from '../../theme/fileIcons';

export interface DiagnosticItem {
  id: string;
  line: number;
  message: string;
}

export interface DirtyFileItem {
  id: string;
  name: string;
}

export type InfoModalKind = 'errors' | 'warnings' | 'dirtyFiles' | null;

interface EditorInfoModalProps {
  kind: InfoModalKind;
  errors: DiagnosticItem[];
  warnings: DiagnosticItem[];
  dirtyFiles: DirtyFileItem[];
  onClose: () => void;
  onSelectDirtyFile: (fileId: string) => void;
}

function getModalConfig(kind: InfoModalKind) {
  switch (kind) {
    case 'errors':
      return { title: 'الأخطاء', icon: 'close-circle' as const, color: '#F25C5C' };
    case 'warnings':
      return { title: 'التحذيرات', icon: 'warning' as const, color: '#F2B84C' };
    case 'dirtyFiles':
      return { title: 'ملفات فيها تعديل غير محفوظ', icon: 'ellipse' as const, color: colors.accent };
    default:
      return { title: '', icon: 'information-circle' as const, color: colors.textMuted };
  }
}

export default function EditorInfoModal({
  kind,
  errors,
  warnings,
  dirtyFiles,
  onClose,
  onSelectDirtyFile,
}: EditorInfoModalProps) {
  if (!kind) return null;

  const config = getModalConfig(kind);
  const diagnostics = kind === 'errors' ? errors : kind === 'warnings' ? warnings : [];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name={config.icon} size={18} color={config.color} />
              <Text style={styles.title}>{config.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {kind === 'dirtyFiles' ? (
            dirtyFiles.length === 0 ? (
              <Text style={styles.emptyText}>مفيش ملفات فيها تعديل غير محفوظ</Text>
            ) : (
              <FlatList
                data={dirtyFiles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => {
                      onSelectDirtyFile(item.id);
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <FileIconBadge fileName={item.name} />
                    <Text style={styles.rowText}>{item.name}</Text>
                    <View style={styles.dirtyDot} />
                  </TouchableOpacity>
                )}
              />
            )
          ) : diagnostics.length === 0 ? (
            <Text style={styles.emptyText}>
              {kind === 'errors' ? 'مفيش أخطاء 🎉' : 'مفيش تحذيرات 👍'}
            </Text>
          ) : (
            <FlatList
              data={diagnostics}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text style={[styles.lineTag, { color: config.color }]}>سطر {item.line}</Text>
                  <Text style={styles.rowText} numberOfLines={2}>{item.message}</Text>
                </View>
              )}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '55%',
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 15,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  lineTag: {
    fontFamily: fonts.uiSemibold,
    fontSize: 12,
    minWidth: 52,
  },
  dirtyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
});