// src/screens/FilesScreen.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, Animated, Dimensions, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { FileIconBadge } from '../theme/fileIcons';
import InputModal from '../components/InputModal';
import ActionModal from '../components/ActionModal';
import FileActionMenu, { FileActionTarget } from '../components/FileActionMenu';
import { saveProjectFiles, loadProjectFiles, loadFileContent, saveFileContent, saveSandboxId, loadSandboxId, clearSandboxId } from '../utils/projectStorage';
import * as SecureStore from 'expo-secure-store';
import { createSandbox, uploadProjectFiles, runExpoTunnel, RunProgressStage } from '../utils/daytonaClient';
import RunSandboxModal from '../components/RunSandboxModal';
import {
  ProjectFile,
  getChildren,
  buildFilePath,
  getDescendantIds,
} from './editor/useEditorFile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.62;

const getMockFiles = (language: 'typescript' | 'javascript'): ProjectFile[] => {
  const appExt = language === 'javascript' ? 'jsx' : 'tsx';
  const files: ProjectFile[] = [
    { id: '1', name: `App.${appExt}`, type: 'file', parentId: null },
    { id: '2', name: 'package.json', type: 'file', parentId: null },
    { id: '3', name: 'src', type: 'folder', parentId: null },
    { id: '4', name: 'app.json', type: 'file', parentId: null },
  ];
  if (language === 'typescript') {
    files.push({ id: '5', name: 'tsconfig.json', type: 'file', parentId: null });
  }
  return files;
};

// المحتوى الحقيقي اللي لازم يتحفظ لكل ملف افتراضي عشان مشروع Expo يشتغل فعليًا
// (بدل المحتوى الفاضي/العام اللي بيتولّد تلقائيًا حسب امتداد الملف بس)
const getDefaultFileContents = (
  language: 'typescript' | 'javascript'
): Record<string, string> => {
  const isTs = language === 'typescript';

  const packageJson = {
    name: 'pocketforge-project',
    version: '1.0.0',
    main: 'expo/AppEntry.js',
    scripts: {
      start: 'expo start',
      android: 'expo start --android',
      ios: 'expo start --ios',
      web: 'expo start --web',
    },
    dependencies: {
      expo: '~54.0.0',
      'expo-status-bar': '~3.0.8',
      react: '19.1.0',
      'react-native': '0.81.4',
    },
    ...(isTs
      ? {
          devDependencies: {
            typescript: '~5.9.2',
            '@types/react': '~19.1.0',
          },
        }
      : {}),
    private: true,
  };

  const appJson = {
    expo: {
      name: 'PocketForge Project',
      slug: 'pocketforge-project',
      version: '1.0.0',
      orientation: 'portrait',
      userInterfaceStyle: 'automatic',
      newArchEnabled: true,
    },
  };

  const appComponent = `import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>مرحبًا من PocketForge!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
`;

  const contents: Record<string, string> = {
    '1': appComponent,
    '2': JSON.stringify(packageJson, null, 2) + '\n',
    '4': JSON.stringify(appJson, null, 2) + '\n',
  };

  if (isTs) {
    contents['5'] = JSON.stringify(
      {
        extends: 'expo/tsconfig.base',
        compilerOptions: { strict: true },
      },
      null,
      2
    ) + '\n';
  }

  return contents;
};

const drawerItems = [
  { key: 'files', label: 'ملفات', icon: 'folder-outline' },
  { key: 'shell', label: 'Shell', icon: 'terminal-outline' },
  { key: 'preview', label: 'معاينة', icon: 'play-outline' },
  { key: 'ai', label: 'AI', icon: 'sparkles-outline' },
];

export default function FilesScreen({ route, navigation }: any) {
  const { projectId, projectName, language } = route.params;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeItem, setActiveItem] = useState('files');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileActionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileActionTarget | null>(null);
  const [menuTarget, setMenuTarget] = useState<FileActionTarget | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [runVisible, setRunVisible] = useState(false);
  const [runStage, setRunStage] = useState<RunProgressStage | 'idle'>('idle');
  const [runMessage, setRunMessage] = useState('');
  const [runTunnelUrl, setRunTunnelUrl] = useState<string | undefined>(undefined);

  // مكدس المجلدات المفتوحة - آخر عنصر هو المجلد الحالي، فاضي يعني إحنا في الجذر
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const hasLoaded = useRef(false);

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;
  const currentFolderName = folderStack.length > 0 ? folderStack[folderStack.length - 1].name : projectName;

  // أول ما الشاشة تفتح: نحمّل قائمة الملفات المحفوظة فعليًا، ولو مفيش، نبدأ بالقايمة الافتراضية ونحفظها
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    loadProjectFiles(projectId).then((saved) => {
      if (saved && saved.length > 0) {
        setFiles(saved as ProjectFile[]);
      } else {
        const defaults = getMockFiles(language || 'typescript');
        setFiles(defaults);
        saveProjectFiles(projectId, defaults);

        const defaultContents = getDefaultFileContents(language || 'typescript');
        Object.entries(defaultContents).forEach(([fileId, content]) => {
          saveFileContent(projectId, fileId, content);
        });
      }
    });
  }, [projectId, language]);

  const visibleFiles = useMemo(
    () => getChildren(currentFolderId, files),
    [currentFolderId, files]
  );

  const persistFiles = useCallback((next: ProjectFile[]) => {
    setFiles(next);
    saveProjectFiles(projectId, next);
  }, [projectId]);

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

  // زرار الرجوع: لو إحنا جوا مجلد، نطلع مستوى واحد بس. لو في الجذر، نقفل الشاشة كلها
  const handleBack = () => {
    if (folderStack.length > 0) {
      setFolderStack((prev) => prev.slice(0, -1));
    } else {
      navigation.goBack();
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled) return;
      const picked = result.assets[0];
      const newFile: ProjectFile = {
        id: Date.now().toString(),
        name: picked.name,
        type: 'file',
        parentId: currentFolderId,
      };
      persistFiles([...files, newFile]);
    } catch (e) {
      Alert.alert('خطأ', 'حصلت مشكلة أثناء استيراد الملف');
    }
  };

  const handleCreateFile = (name: string) => {
    const newFile: ProjectFile = {
      id: Date.now().toString(),
      name,
      type: 'file',
      parentId: currentFolderId,
    };
    persistFiles([...files, newFile]);
    setFileModalVisible(false);
  };

  const handleCreateFolder = (name: string) => {
    const newFolder: ProjectFile = {
      id: Date.now().toString(),
      name,
      type: 'folder',
      parentId: currentFolderId,
    };
    persistFiles([...files, newFolder]);
    setFolderModalVisible(false);
  };

  const openItem = (item: ProjectFile) => {
    if (item.type === 'folder') {
      setFolderStack((prev) => [...prev, { id: item.id, name: item.name }]);
    } else {
      navigation.navigate('Editor', {
        projectId,
        projectName,
        files,
        initialFileId: item.id,
      });
    }
  };

  const openMenuFor = (item: ProjectFile) => {
    setMenuTarget({ id: item.id, name: item.name, type: item.type });
    setMenuVisible(true);
  };

  const handleDownload = async (target: FileActionTarget) => {
    try {
      const content = await loadFileContent(projectId, target.id);
      const file = new File(Paths.cache, target.name);
      file.write(content ?? '');

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('غير متاح', 'المشاركة مش متاحة على الجهاز ده');
        return;
      }
      await Sharing.shareAsync(file.uri);
    } catch (e) {
      Alert.alert('خطأ', 'حصلت مشكلة أثناء تجهيز الملف للتحميل');
    }
  };

  const handleMenuAction = async (action: string, target: FileActionTarget) => {
    setMenuVisible(false);

    switch (action) {
      case 'rename':
        setRenameTarget(target);
        break;

      case 'copyPath': {
        const path = buildFilePath(target.id, files);
        await Clipboard.setStringAsync(path);
        Alert.alert('تم', 'اتنسخ المسار: ' + path);
        break;
      }

      case 'duplicate': {
        const original = files.find((f) => f.id === target.id);
        if (!original) return;
        const dotIndex = original.name.lastIndexOf('.');
        const baseName = dotIndex > 0 ? original.name.slice(0, dotIndex) : original.name;
        const ext = dotIndex > 0 ? original.name.slice(dotIndex) : '';
        const copyName = `${baseName}-copy${ext}`;
        const content = await loadFileContent(projectId, target.id);

        const newFile: ProjectFile = {
          id: Date.now().toString(),
          name: copyName,
          type: 'file',
          parentId: original.parentId,
        };
        persistFiles([...files, newFile]);
        if (content !== null) {
          await saveFileContent(projectId, newFile.id, content);
        }
        break;
      }

      case 'download':
        await handleDownload(target);
        break;

      case 'addFile':
        setFolderStack((prev) => [...prev, { id: target.id, name: target.name }]);
        setFileModalVisible(true);
        break;

      case 'addFolder':
        setFolderStack((prev) => [...prev, { id: target.id, name: target.name }]);
        setFolderModalVisible(true);
        break;

      case 'delete':
        setDeleteTarget(target);
        break;
    }
  };

  const handleRenameSubmit = (newName: string) => {
    if (!renameTarget) return;
    const next = files.map((f) => (f.id === renameTarget.id ? { ...f, name: newName } : f));
    persistFiles(next);
    setRenameTarget(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const idsToDelete = deleteTarget.type === 'folder'
      ? [deleteTarget.id, ...getDescendantIds(deleteTarget.id, files)]
      : [deleteTarget.id];

    persistFiles(files.filter((f) => !idsToDelete.includes(f.id)));
    setDeleteTarget(null);
  };
  
  const handleRun = async () => {
    const apiKey = await SecureStore.getItemAsync('pocketforge_apikey_daytona');
    if (!apiKey) {
      Alert.alert('محتاج مفتاح', 'روح لشاشة الإعدادات واحفظ مفتاح Daytona الأول');
      return;
    }

    setRunVisible(true);
    setRunStage('idle');
    setRunTunnelUrl(undefined);

    try {
      // نحاول نستخدم Sandbox موجود من قبل لنفس المشروع بدل ما ننشئ واحد جديد
      // (كل Sandbox جديد بياخد مساحة من الحساب، وده كان بيسبب امتلاء المساحة بسرعة)
      let sandboxId = await loadSandboxId(projectId);

      if (!sandboxId) {
        setRunMessage('جاري إنشاء بيئة تشغيل جديدة...');
        sandboxId = await createSandbox(apiKey);
        await saveSandboxId(projectId, sandboxId);
      } else {
        setRunMessage('جاري إعادة الاتصال ببيئة التشغيل الموجودة...');
      }

      setRunMessage('جاري رفع ملفات المشروع...');
      await uploadProjectFiles(apiKey, sandboxId, projectId, files, (progress) => {
        setRunMessage(`جاري رفع الملفات... (${progress.done}/${progress.total})`);
      });

      const expoToken = await SecureStore.getItemAsync('pocketforge_apikey_expo');
      const tunnelUrl = await runExpoTunnel(apiKey, sandboxId, (progress) => {
        setRunStage(progress.stage);
        setRunMessage(progress.message);
        if (progress.tunnelUrl) setRunTunnelUrl(progress.tunnelUrl);
      }, expoToken ?? undefined);

      setRunTunnelUrl(tunnelUrl);
    } catch (err: any) {
      // لو الـ Sandbox القديم اتحذف/وقف من عند Daytona (خمول طويل مثلًا)، نمسح الـ id المحفوظ
      // عشان المحاولة الجاية تنشئ واحد جديد بدل ما تفضل تفشل على نفس الـ id الميت
      if (err?.message?.includes('404')) {
        await clearSandboxId(projectId);
      }
      setRunStage('failed');
      setRunMessage(err?.message ?? 'حصلت مشكلة غير متوقعة أثناء التشغيل');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{currentFolderName}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleRun}>
          <Ionicons name="play" size={18} color={colors.accent} />
        </TouchableOpacity>
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
          data={visibleFiles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.ftRow}
              onPress={() => openItem(item)}
              onLongPress={() => openMenuFor(item)}
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
      <InputModal
        visible={!!renameTarget}
        title="إعادة تسمية"
        placeholder="الاسم الجديد"
        initialValue={renameTarget?.name}
        submitLabel="حفظ"
        onCancel={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
      />

      <ActionModal
        visible={!!deleteTarget}
        title={deleteTarget?.name ?? ''}
        subtitle={deleteTarget?.type === 'folder' ? 'هيتحذف المجلد وكل اللي جواه' : 'اختر إجراء'}
        onCancel={() => setDeleteTarget(null)}
        options={[{ label: 'حذف', onPress: handleDeleteConfirm, destructive: true }]}
      />

      <FileActionMenu
        visible={menuVisible}
        target={menuTarget}
        onClose={() => setMenuVisible(false)}
        onAction={handleMenuAction}
      />

      <RunSandboxModal
        visible={runVisible}
        stage={runStage}
        message={runMessage}
        tunnelUrl={runTunnelUrl}
        onClose={() => setRunVisible(false)}
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
