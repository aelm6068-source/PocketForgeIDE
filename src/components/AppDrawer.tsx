// src/components/AppDrawer.tsx
// الشريط الجانبي (Drawer) بكل مميزاته - متطلّع من FilesScreen.tsx لملف مستقل
// عشان يبقى مكان واحد نضيف عليه أي مميزات جديدة من غير ما نلمس شاشة الملفات نفسها خالص
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.62;

// ⭐ لون تحذيري لعنصر التنظيف - منفصل عن ألوان الثيم العادية عشان يبان إنه إجراء حساس
const DANGER_COLOR = '#F87171';

type AppDrawerProps = {
  visible: boolean;
  onClose: () => void;
  activeItem: string;
  onSelectItem: (key: string) => void;
  // ⭐ زرار "فتح في Expo Go" - نفس وظيفة زرار ▶ اللي كان في الـ topbar بالظبط،
  // بس اتنقل مكانه هنا بطلب المستخدم بدل ما يفضل في شريط العنوان
  onRunPress: () => void;
  // ⭐ الجديد: زرار مسح وتنظيف سيرفر المشروع (Daytona Sandbox)
  onCleanupPress: () => void;
};

export default function AppDrawer({
  visible,
  onClose,
  activeItem,
  onSelectItem,
  onRunPress,
  onCleanupPress,
}: AppDrawerProps) {
  const { t } = useLanguage();

  // بنفضل الـ Drawer نفسه mounted لحد ما أنيميشن القفل يخلص، عشان يفضل
  // يظهر وهو بيتحرك للخارج بدل ما يختفي فجأة
  const [mounted, setMounted] = useState(visible);
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  // "Shell" و"AI" أسماء إنجليزية ثابتة مش محتاجة ترجمة
  const drawerItems = [
    { key: 'files', label: t('drawer_files'), icon: 'folder-outline' },
    { key: 'shell', label: 'Shell', icon: 'terminal-outline' },
    { key: 'preview', label: t('drawer_preview'), icon: 'play-outline' },
    { key: 'ai', label: 'AI', icon: 'sparkles-outline' },
  ];

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(slideAnim, {
        toValue: DRAWER_WIDTH,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible]);

  return (
    <>
      {mounted && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      )}
      <Animated.View
        style={[
          styles.drawer,
          { width: DRAWER_WIDTH, transform: [{ translateX: slideAnim }] },
        ]}
        pointerEvents={mounted ? 'auto' : 'none'}
      >
        <View style={styles.drawerHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        {drawerItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.drawerItem, activeItem === item.key && styles.drawerItemActive]}
            onPress={() => {
              onSelectItem(item.key);
              onClose();
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name={item.icon as any}
              size={22}
              color={activeItem === item.key ? 'white' : colors.textMuted}
            />
            <Text style={[styles.drawerLabel, activeItem === item.key && { color: 'white' }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.divider} />

        {/* ⭐ عنصر: زرار تشغيل المشروع - نفس handleRun اللي كان في الـ topbar */}
        <TouchableOpacity
          style={styles.drawerItem}
          onPress={() => {
            onRunPress();
            onClose();
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="rocket-outline" size={22} color={colors.accent} />
          <Text style={[styles.drawerLabel, { color: colors.accent }]}>{t('drawer_open_in_expo_go')}</Text>
        </TouchableOpacity>

        {/* ⭐ الجديد: زرار مسح وتنظيف سيرفر المشروع */}
        <TouchableOpacity
          style={styles.drawerItem}
          onPress={() => {
            onCleanupPress();
            onClose();
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="trash-outline" size={22} color={DANGER_COLOR} />
          <Text style={[styles.drawerLabel, { color: DANGER_COLOR }]}>{t('drawer_cleanup_server')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40,
  },
  drawer: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    backgroundColor: '#0C0A13',
    borderLeftWidth: 1, borderLeftColor: colors.border,
    padding: spacing.md, gap: 6, zIndex: 50,
  },
  drawerHeader: { alignItems: 'flex-start', marginBottom: spacing.lg, paddingTop: spacing.sm },
  drawerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: radius.lg,
  },
  drawerItemActive: { backgroundColor: colors.accent },
  drawerLabel: { fontSize: 14, color: colors.textMuted, fontFamily: fonts.uiSemibold },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});