// src/components/ai/AiPanel.tsx
// تاب الذكاء الاصطناعي: لو الإعداد مش جاهز يعرض الإعدادات، وإلا المحادثة (والإعدادات بزرار).
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useAiSettings } from '../../ai/useAiSettings';
import AiSettingsView from './AiSettingsView';
import AiChatView from './AiChatView';
import type { ProjectFile } from '../../screens/editor/useEditorFile';

interface Props {
  projectName: string;
  files: ProjectFile[];
}

export default function AiPanel({ projectName, files }: Props) {
  const s = useAiSettings();
  const [editing, setEditing] = useState(false);

  if (!s.loaded) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      {s.ready && !editing ? (
        <AiChatView
          provider={s.provider}
          apiKey={s.savedKey}
          model={s.model}
          projectName={projectName}
          files={files}
          onOpenSettings={() => setEditing(true)}
        />
      ) : (
        <AiSettingsView s={s} onDone={() => setEditing(false)} onCancel={s.ready ? () => setEditing(false) : undefined} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});