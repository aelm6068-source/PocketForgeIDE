// src/screens/FilesScreen.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, Image, Modal, TextInput,
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
import AppDrawer from '../components/AppDrawer';
import { saveProjectFiles, loadProjectFiles, loadFileContent, saveFileContent, saveSandboxId, loadSandboxId, clearSandboxId, loadProjectsList } from '../utils/projectStorage';
import * as SecureStore from 'expo-secure-store';
import { createSandbox, uploadProjectFiles, runExpoTunnel, RunProgressStage, deleteSandbox, listSandboxes } from '../utils/daytonaClient';
import RunSandboxModal from '../components/RunSandboxModal';
import {
  ProjectFile,
  getChildren,
  buildFilePath,
  getDescendantIds,
} from './editor/useEditorFile';
import { isImageFile } from '../theme/defaultAssets';
import { buildProjectFiles, buildProjectFileContents } from '../utils/projectTemplate';

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
  const [imagePreview, setImagePreview] = useState<{ name: string; base64: string | null } | null>(null);
  // ⭐ الجديد: حالة البحث في الملفات والمجلدات
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        const defaults = buildProjectFiles(language || 'typescript');
        setFiles(defaults);
        saveProjectFiles(projectId, defaults);

        const defaultContents = buildProjectFileContents(language || 'typescript', projectName || 'مشروعي');
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

  // ⭐ الجديد: يبني تسلسل المجلدات من الجذر لحد مجلد معين - مستخدم لما نفتح نتيجة بحث
  // موجودة جوه مجلد تاني، عشان زرار الرجوع يشتغل صح بعدها
  const buildFolderStackTo = useCallback((folderId: string): { id: string; name: string }[] => {
    const chain: { id: string; name: string }[] = [];
    let current = files.find((f) => f.id === folderId);
    while (current) {
      chain.unshift({ id: current.id, name: current.name });
      const parentId: string | null = current.parentId;
      current = parentId ? files.find((f) => f.id === parentId) : undefined;
    }
    return chain;
  }, [files]);

  // ⭐ الجديد: نتائج البحث - بالاسم بس، وبتدور في كل ملفات ومجلدات المشروع مش بس المجلد الحالي
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return files
      .filter((f) => f.name.toLowerCase().includes(q))
      .map((f) => ({ ...f, path: buildFilePath(f.id, files) }));
  }, [searchQuery, files]);

  const closeSearch = () => {
    setSearchVisible(false);
    setSearchQuery('');
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

      // نقرأ الملف عن طريق fetch (بيتعامل صح مع روابط content:// من معرض الصور)
      try {
        const response = await fetch(picked.uri);
        if (isImageFile(picked.name)) {
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('فشلت قراءة بيانات الصورة'));
            reader.onload = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl.split(',')[1] ?? '');
            };
            reader.readAsDataURL(blob);
          });
          await saveFileContent(projectId, newFile.id, base64);
        } else {
          const text = await response.text();
          await saveFileContent(projectId, newFile.id, text);
        }
      } catch (readErr: any) {
        Alert.alert('تحذير', 'اتضاف الملف للقايمة لكن حصلت مشكلة في قراءة محتواه: ' + String(readErr?.message || readErr));
      }

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
    } else if (isImageFile(item.name)) {
      openImagePreview(item.id, item.name);
    } else {
      navigation.navigate('Editor', {
        projectId,
        projectName,
        files,
        initialFileId: item.id,
      });
    }
  };

  // ⭐ الجديد: فتح نتيجة بحث - لو مجلد نبني مسار كامل ليه من الجذر، لو ملف نفتحه عادي
  const handleSearchResultPress = (item: ProjectFile) => {
    closeSearch();
    if (item.type === 'folder') {
      setFolderStack(buildFolderStackTo(item.id));
    } else {
      openItem(item);
    }
  };

  const openImagePreview = async (fileId: string, fileName: string) => {
    const base64 = await loadFileContent(projectId, fileId);
    setImagePreview({ name: fileName, base64: base64 ?? null });
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
      if (err?.message?.includes('404')) {
        await clearSandboxId(projectId);
      }
      setRunStage('failed');
      setRunMessage(err?.message ?? 'حصلت مشكلة غير متوقعة أثناء التشغيل');
    }
  };
  const handleCleanupServer = () => {
    Alert.alert(
      'تنظيف السيرفر',
      'هيتم مسح سيرفر المشروع ده (هيشتغل من جديد المرة الجاية)، وأي سيرفرات تايهة مش تابعة لأي مشروع عندك. متأكد؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'مسح', style: 'destructive', onPress: runCleanupServer },
      ]
    );
  };

  const runCleanupServer = async () => {
    const apiKey = await SecureStore.getItemAsync('pocketforge_apikey_daytona');
    if (!apiKey) {
      Alert.alert('محتاج مفتاح', 'روح لشاشة الإعدادات واحفظ مفتاح Daytona الأول');
      return;
    }

    try {
      // امسح سيرفر المشروع الحالي نفسه لو موجود
      const currentSandboxId = await loadSandboxId(projectId);
      if (currentSandboxId) {
        await deleteSandbox(apiKey, currentSandboxId);
        await clearSandboxId(projectId);
      }

      // اجمع كل الـ sandboxIds المعروفة (تابعة لمشاريع موجودة فعليًا) عشان منمسحش سيرفرات مشاريع تانية شغالة
      const allProjects = (await loadProjectsList()) ?? [];
      const knownSandboxIds = new Set<string>();
      for (const project of allProjects) {
        const sid = await loadSandboxId(project.id);
        if (sid) knownSandboxIds.add(sid);
      }

      // هات كل الـ Sandboxes الفعلية من Daytona، وامسح اللي مش تابع لأي مشروع معروف
      const liveSandboxes = await listSandboxes(apiKey);
      let cleanedCount = 0;
      for (const sandbox of liveSandboxes) {
        if (!knownSandboxIds.has(sandbox.id)) {
          await deleteSandbox(apiKey, sandbox.id);
          cleanedCount += 1;
        }
      }

      Alert.alert(
        'تم',
        `اتمسح سيرفر المشروع ده${cleanedCount > 0 ? `، وكمان ${cleanedCount} سيرفر تايه` : ''}.`
      );
    } catch (err: any) {
      Alert.alert('خطأ', 'حصلت مشكلة أثناء تنظيف السيرفر: ' + String(err?.message || err));
    }
  };
  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{currentFolderName}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setSearchVisible(true)}>
          <Ionicons name="search" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)}>
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

      <AppDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeItem={activeItem}
        onSelectItem={setActiveItem}
        onRunPress={handleRun}
        onCleanupPress={handleCleanupServer}
      />

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

      <Modal
        visible={!!imagePreview}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreview(null)}
      >
        <TouchableOpacity
          style={styles.imagePreviewOverlay}
          activeOpacity={1}
          onPress={() => setImagePreview(null)}
        >
          <Text style={styles.imagePreviewName}>{imagePreview?.name}</Text>
          {imagePreview?.base64 ? (
            <Image
              source={{ uri: `data:image/png;base64,${imagePreview.base64}` }}
              style={styles.imagePreviewImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.imagePreviewName}>مفيش محتوى محفوظ للصورة دي</Text>
          )}
          <Text style={styles.imagePreviewHint}>دوس في أي مكان للإغلاق</Text>
        </TouchableOpacity>
      </Modal>

      {/* ⭐ الجديد: مودال البحث في الملفات والمجلدات */}
      <Modal
        visible={searchVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSearch}
      >
        <View style={styles.searchOverlay}>
          <View style={styles.searchBox}>
            <View style={styles.searchHeader}>
              <TextInput
                style={styles.searchInput}
                placeholder="ابحث عن ملف أو مجلد..."
                placeholderTextColor={colors.textFaint}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={closeSearch}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchQuery.trim().length > 0 ? (
                  <Text style={styles.searchEmpty}>مفيش نتائج</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultRow}
                  onPress={() => handleSearchResultPress(item)}
                  activeOpacity={0.7}
                >
                  {item.type === 'folder' ? (
                    <View style={styles.folderIcon}>
                      <Ionicons name="folder" size={17} color={colors.accent} />
                    </View>
                  ) : (
                    <FileIconBadge fileName={item.name} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ftName}>{item.name}</Text>
                    <Text style={styles.searchResultPath} numberOfLines={1}>{item.path}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    gap: spacing.sm
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
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  imagePreviewImage: {
    width: '90%',
    height: '70%',
  },
  imagePreviewName: {
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  imagePreviewHint: {
    color: colors.textFaint,
    fontFamily: fonts.ui,
    fontSize: 12,
    marginTop: spacing.lg,
  },
  // ⭐ الجديد: ستايلات مودال البحث
  searchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
  },
  searchBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 15,
    paddingVertical: 6,
  },
  searchEmpty: {
    color: colors.textFaint,
    fontFamily: fonts.ui,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: spacing.md,
  },
  searchResultPath: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.ui,
    marginTop: 2,
  },
});