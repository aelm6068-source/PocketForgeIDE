// src/components/InputModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Pressable, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';

interface Props {
  visible: boolean;
  title: string;
  placeholder: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
  // قيمة ابتدائية تظهر جاهزة للتعديل جوا الحقل (مفيدة لإعادة التسمية) - اختيارية
  initialValue?: string;
  // نص الزرار الرئيسي - افتراضيًا "إنشاء"، ممكن تغيّره لـ "حفظ" مثلًا
  submitLabel?: string;
}

export default function InputModal({
  visible,
  title,
  placeholder,
  onCancel,
  onSubmit,
  initialValue,
  submitLabel,
}: Props) {
  const [value, setValue] = useState('');

  // كل ما المودال يتفتح، نملأ الحقل بالقيمة الابتدائية (لو فيه) عشان تبقى جاهزة للتعديل مباشرة
  useEffect(() => {
    if (visible) {
      setValue(initialValue ?? '');
    }
  }, [visible, initialValue]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  };

  const handleCancel = () => {
    setValue('');
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
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            textAlign="right"
            autoFocus
            selectTextOnFocus
          />
          <TouchableOpacity style={styles.createBtn} onPress={handleSubmit} activeOpacity={0.85}>
            <Text style={styles.createBtnText}>{submitLabel ?? 'إنشاء'}</Text>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
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
    marginBottom: spacing.lg,
  },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  createBtnText: { color: 'white', fontFamily: fonts.uiSemibold, fontSize: 15 },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontFamily: fonts.uiMedium, fontSize: 14 },
});
