// src/components/ActionModal.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';

export interface ModalOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: ModalOption[];
  onCancel: () => void;
}

export default function ActionModal({ visible, title, subtitle, options, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <View style={styles.optionsContainer}>
            {options.map((opt, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionBtn,
                  opt.destructive && styles.optionBtnDestructive,
                ]}
                onPress={opt.onPress}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.optionText,
                    opt.destructive && styles.optionTextDestructive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
            <Text style={styles.cancelText}>إلغاء</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
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
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  optionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  optionBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  optionBtnDestructive: {
    backgroundColor: 'rgba(242,96,122,0.12)',
    borderColor: 'rgba(242,96,122,0.3)',
  },
  optionText: {
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 15,
  },
  optionTextDestructive: {
    color: colors.error,
  },
  cancelBtn: {
    marginTop: spacing.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textMuted,
    fontFamily: fonts.uiMedium,
    fontSize: 15,
  },
});