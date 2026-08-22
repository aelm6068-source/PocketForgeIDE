// src/components/CreateProjectModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { ProjectLanguage } from '../theme/types';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string, language: ProjectLanguage) => void;
}

export default function CreateProjectModal({ visible, onCancel, onCreate }: Props) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<ProjectLanguage>('typescript');

  const handleCreate = () => {
    const finalName = name.trim() || 'مشروع جديد';
    onCreate(finalName, language);
    setName('');
    setLanguage('typescript');
  };

  const handleCancel = () => {
    setName('');
    setLanguage('typescript');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayPress} onPress={handleCancel} />
        <View style={styles.sheet}>
          <Text style={styles.title}>مشروع جديد</Text>

          <Text style={styles.label}>اسم المشروع</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="اكتب اسم المشروع"
            placeholderTextColor={colors.textFaint}
            textAlign="right"
          />

          <Text style={styles.label}>لغة المشروع</Text>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langChip, language === 'typescript' && styles.langChipActiveTs]}
              onPress={() => setLanguage('typescript')}
            >
              <Text
                style={[
                  styles.langChipText,
                  language === 'typescript' && { color: colors.typescript },
                ]}
              >
                TypeScript
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langChip, language === 'javascript' && styles.langChipActiveJs]}
              onPress={() => setLanguage('javascript')}
            >
              <Text
                style={[
                  styles.langChipText,
                  language === 'javascript' && { color: colors.javascript },
                ]}
              >
                JavaScript
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.createBtn} onPress={handleCreate} activeOpacity={0.85}>
            <Text style={styles.createBtnText}>إنشاء المشروع</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  overlayPress: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    padding: spacing.lg,
    paddingBottom: 36,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.displaySemibold,
    fontSize: 17,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.uiMedium,
    fontSize: 12.5,
    marginBottom: spacing.xs,
    textAlign: 'right',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  langRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  langChip: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  langChipActiveTs: {
    backgroundColor: 'rgba(124,106,242,0.15)',
    borderColor: colors.typescript,
  },
  langChipActiveJs: {
    backgroundColor: 'rgba(242,184,74,0.12)',
    borderColor: colors.javascript,
  },
  langChipText: {
    color: colors.textMuted,
    fontFamily: fonts.uiSemibold,
    fontSize: 13.5,
  },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  createBtnText: {
    color: 'white',
    fontFamily: fonts.uiSemibold,
    fontSize: 15,
  },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelText: {
    color: colors.textMuted,
    fontFamily: fonts.uiMedium,
    fontSize: 14,
  },
});