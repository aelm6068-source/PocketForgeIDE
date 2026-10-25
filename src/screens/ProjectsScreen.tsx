// src/screens/ProjectsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useProjects } from '../theme/useProjects';
import { Project, ProjectLanguage } from '../theme/types';
import ProjectCard from '../components/ProjectCard';
import ActionModal from '../components/ActionModal';
import CreateProjectModal from '../components/CreateProjectModal';
import GithubImportModal from '../components/GithubImportModal';
import ZipImportModal from '../components/ZipImportModal';
import { useZipImport } from '../github/useZipImport';
import type { ImportedProject } from '../github/useGithubImport';
import { useLanguage } from '../i18n/LanguageContext';

export default function ProjectsScreen({ navigation }: any) {
  const { t } = useLanguage();
  const { projects, addProject, deleteProject, reload } = useProjects();
  const [addModalVisible, setAddModalVisible] = useState(false);
    const [importVisible, setImportVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // كل ما نرجع لشاشة المشاريع (مثلًا بعد الشغل جوه مشروع) نعيد قراءة القايمة
  // عشان وقت "آخر تعديل" يتحدّث
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      reload();
    });
    return unsubscribe;
  }, [navigation, reload]);

  const handleCreate = (name: string, language: ProjectLanguage) => {
    addProject(name, language);
    setAddModalVisible(false);
  };
  // مشروع اتستورد من GitHub: بنضيفه للقايمة، وزرار "فتح المشروع" بيفتحه
  const handleImported = (project: ImportedProject) => {
    addProject(project.name, project.language, project.id);
  };

    const zip = useZipImport(handleImported, t('create_project_default_name'));
  const handleOpenImported = (project: ImportedProject) => {
    setImportVisible(false);
      zip.close();
    navigation.navigate('Files', {
      projectId: project.id,
      projectName: project.name,
      language: project.language,
    });
  };
  
  const handleDelete = () => {
    if (deleteTarget) {
      deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const openProject = (project: Project) => {
    navigation.navigate('Files', {
      projectId: project.id,
      projectName: project.name,
      language: project.language,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <Text style={styles.title}>{t('projects_title')}</Text>
      </View>

      {projects.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('projects_empty_title')}</Text>
          <Text style={styles.emptySubtext}>{t('projects_empty_subtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => openProject(item)}
              onLongPress={() => setDeleteTarget({ id: item.id, name: item.name })}
            />
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="white" />
      </TouchableOpacity>

      <CreateProjectModal
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
                onCreate={handleCreate}
        onImportGithub={() => {
          setAddModalVisible(false);
          setImportVisible(true);
        }}
                onImportZip={() => {
          setAddModalVisible(false);
          // نستنى نافذة الإنشاء تقفل قبل ما نفتح منتقي الملفات (مهم على iOS)
          setTimeout(() => void zip.start(), 350);
        }}
      />
            <GithubImportModal
        visible={importVisible}
        onImported={handleImported}
        onOpen={handleOpenImported}
        onClose={() => setImportVisible(false)}
      />
            <ZipImportModal ui={zip.ui} onOpen={handleOpenImported} onClose={zip.close} />

      <ActionModal
        visible={!!deleteTarget}
        title={deleteTarget?.name ?? ''}
        subtitle={t('projects_delete_subtitle')}
        onCancel={() => setDeleteTarget(null)}
        options={[{ label: t('common_delete'), onPress: handleDelete, destructive: true }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topbar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    textAlign: 'right',
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  emptySubtext: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 13 },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});