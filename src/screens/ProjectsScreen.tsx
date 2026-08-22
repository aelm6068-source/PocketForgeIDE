// src/screens/ProjectsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { useProjects } from '../theme/useProjects';
import { Project, ProjectLanguage } from '../theme/types';
import ProjectCard from '../components/ProjectCard';
import ActionModal from '../components/ActionModal';
import CreateProjectModal from '../components/CreateProjectModal';

export default function ProjectsScreen({ navigation }: any) {
  const { projects, addProject, deleteProject } = useProjects();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = (name: string, language: ProjectLanguage) => {
    addProject(name, language);
    setAddModalVisible(false);
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
        <Text style={styles.title}>مشاريعي</Text>
      </View>

      {projects.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>مفيش مشاريع لسه</Text>
          <Text style={styles.emptySubtext}>دوس على (+) عشان تبدأ أول مشروع</Text>
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
      />

      <ActionModal
        visible={!!deleteTarget}
        title={deleteTarget?.name ?? ''}
        subtitle="اختر إجراء"
        onCancel={() => setDeleteTarget(null)}
        options={[{ label: 'حذف', onPress: handleDelete, destructive: true }]}
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