// src/components/ProjectCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { Project } from '../theme/types';

interface Props {
  project: Project;
  onPress: () => void;
  onLongPress: () => void;
}

export default function ProjectCard({ project, onPress, onLongPress }: Props) {
  const isTs = project.language === 'typescript';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.tag,
            { backgroundColor: isTs ? 'rgba(124,106,242,0.18)' : 'rgba(242,184,74,0.15)' },
          ]}
        >
          <Text
            style={[
              styles.tagText,
              { color: isTs ? colors.typescript : colors.javascript },
            ]}
          >
            {isTs ? 'TS' : 'JS'}
          </Text>
        </View>
      </View>
      <Text style={styles.name}>{project.name}</Text>
      <Text style={styles.meta}>آخر تعديل: {project.lastModified}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.lg,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  tagText: {
    fontFamily: fonts.codeBold,
    fontSize: 10,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.displaySemibold,
    fontSize: 17,
    marginBottom: 4,
    textAlign: 'right',
  },
  meta: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
    textAlign: 'right',
  },
});