// src/screens/FilesScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, Animated, Dimensions, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { FileIconBadge } from '../theme/fileIcons';
import InputModal from '../components/InputModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.62;

// الملفات الوهمية بتتولد حسب لغة المشروع
const getMockFiles = (language: 'typescript' | 'javascript') => {
  const appExt = language === 'javascript' ? 'jsx' : 'tsx';
  return [
    { id: '1', name: `App.${appExt}`, type: 'file' },
    { id: '2', name: 'package.json', type: 'file' },
    { id: '3', name: 'src', type: 'folder' },
  ];
};

const drawerItems = [
  { key: 'files', label: 'ملفات', icon: 'folder-outline' },
  { key: 'shell', label: 'Shell', icon: 'terminal-outline' },
  { key: 'preview', label: 'معاينة', icon: 'play-outline' },
  { key: 'ai', label: 'AI', icon: 'sparkles-outline' },
];

export default function FilesScreen({ route, navigation }: any) {
  const { projectName, language } = route.params;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeItem, setActiveItem] = useState('files');
  const [files, setFiles] = useState(getMockFiles(language || 'typescript'));
  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [folderModalVisible, setFolderModalVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(slideAnim, {
      toValue: DRAWER_WIDTH,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setDrawerOpen(false));
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled) return;
      const picked = result.assets[0];
      setFiles((prev) => [...prev, { id: Date.now().toString(), name: picked.name, type: 'file' }]);
    } catch (e) {
      Alert.alert('خطأ', 'حصلت مشكلة أثناء استيراد الملف');
    }
  };

  const handleExport = async (fileName: string) => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('غير متاح', 'المشاركة مش متاحة على الجهاز ده');
      return;
    }
    Alert.alert('تصدير', `هيتم تجهيز "${fileName}" للتصدير لما نربط نظام الملفات الحقيقي`);
  };

  const handleCreateFile = (name: string) => {
    setFiles((prev) => [...prev, { id: Date.now().toString(), name, type: 'file' }]);
    setFileModalVisible(false);
  };

  const handleCreateFolder = (name: string) => {
    setFiles((prev) => [...prev, { id: Date.now().toString(), name, type: 'folder' }]);
    setFolderModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{projectName}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={openDrawer}>
          <Ionicons name="menu" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.fileTree}>
        <View style={styles.ftActions}>
          <TouchableOpacity style={styles.ftBtn} onPress={() => setFileModalVisible(true)}>
            <Text style={styles.ftBtnText}>+ ملف</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ftBtn} onPress={() => setFolderModalVisible(true)}>
            <Text style={styles.ftBtnText}>+ مجلد</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ftBtn} onPress={handleImport}>
            <Text style={styles.ftBtnText}>استيراد</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.ftRow}
              onPress={() => {
                if (item.type === 'file') {
                  navigation.navigate('Editor', {
                    projectName,
                    files,
                    initialFileId: item.id,
                  });
                }
              }}
              onLongPress={() => item.type === 'file' && handleExport(item.name)}
              activeOpacity={0.7}
              >
              {item.type === 'folder' ? (
                <View style={styles.folderIcon}>
                  <Ionicons name="folder" size={17} color={colors.accent} />
                </View>
              ) : (
                <FileIconBadge fileName={item.name} />
              )}
              <Text style={styles.ftName}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {drawerOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeDrawer} />
      )}

      <Animated.View
        style={[
          styles.drawer,
          { width: DRAWER_WIDTH, transform: [{ translateX: slideAnim }] },
        ]}
        pointerEvents={drawerOpen ? 'auto' : 'none'}
      >
        <View style={styles.drawerHeader}>
          <TouchableOpacity onPress={closeDrawer}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        {drawerItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.drawerItem, activeItem === item.key && styles.drawerItemActive]}
            onPress={() => {
              setActiveItem(item.key);
              closeDrawer();
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
      </Animated.View>

      <InputModal
        visible={fileModalVisible}
        title="ملف جديد"
        placeholder="مثال: index.ts"
        onCancel={() => setFileModalVisible(false)}
        onSubmit={handleCreateFile}
      />
      <InputModal
        visible={folderModalVisible}
        title="مجلد جديد"
        placeholder="مثال: components"
        onCancel={() => setFolderModalVisible(false)}
        onSubmit={handleCreateFolder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1, color: colors.text, fontFamily: fonts.displaySemibold,
    fontSize: 16, textAlign: 'center',
  },
  fileTree: { flex: 1, padding: spacing.md },
  ftActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  ftBtn: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 9, alignItems: 'center',
  },
  ftBtnText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.uiSemibold },
  ftRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 8,
  },
  folderIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  ftName: { color: colors.text, fontSize: 14, fontFamily: fonts.ui },
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
});