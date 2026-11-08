// src/components/ai/AiPanel.tsx
// تاب الذكاء الاصطناعي: لو مفيش خانات (مفاتيح) يعرض الإعدادات، وإلا المحادثة (والإعدادات بزرار).
// لما المستخدم يخلّص من الإعدادات، المفتاح والموديل الي اختارهم بيتحوّلوا لخانة،
// والخانة دي بتبقى الأولى في ترتيب الدردشة (الباقي احتياطي لو فشلت).
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useAiSettings } from '../../ai/useAiSettings';
import { useAiSlots } from '../../ai/useAiSlots';
import { pickSlots } from '../../ai/router';
import AiSettingsView from './AiSettingsView';
import AiChatView from './AiChatView';
import type { ProjectFile } from '../../screens/editor/useEditorFile';

interface Props {
  projectId: string;
  projectName: string;
  files: ProjectFile[];
}

export default function AiPanel({ projectId, projectName, files }: Props) {
  const s = useAiSettings();
  const ai = useAiSlots();
  const [editing, setEditing] = useState(false);

  const headerLabel = useMemo(() => {
    const first = pickSlots('chat', ai.slots, ai.rules, {}, Date.now(), false).candidates[0] ?? ai.slots[0];
    if (!first) return '';
    return ai.slots.length > 1 ? `${first.model} +${ai.slots.length - 1}` : first.model;
  }, [ai.slots, ai.rules]);

  // الإعدادات خلصت: نحوّل المفتاح والموديل المختارين لخانة (أو نحدّث مفتاحها) ونخليها الأولى للدردشة
  const finishSettings = async () => {
    if (s.ready) {
      try {
        const existing = ai.slots.find((x) => x.provider === s.provider && x.model === s.model);
        let id = existing?.id;
        if (existing) {
          await ai.setKey(existing.id, s.savedKey);
        } else {
          const info = s.models.find((m) => m.id === s.model);
          const created = await ai.add(
            { provider: s.provider, model: s.model, tools: info?.tools, vision: info?.vision },
            s.savedKey
          );
          id = created?.id;
        }
        if (id) {
          const rest = ai.slots.filter((x) => x.id !== id).map((x) => x.id);
          await ai.setRule('chat', { mode: 'manual', order: [id, ...rest] });
        }
      } catch (err) {
        console.warn('AI: failed to save slot', err);
      }
    }
    setEditing(false);
  };

  if (!s.loaded || !ai.loaded) return <View style={styles.root} />;

  const hasSlots = ai.slots.length > 0;

  return (
    <View style={styles.root}>
      {hasSlots && !editing ? (
        <AiChatView
          projectId={projectId}
          route={ai.route}
          headerLabel={headerLabel}
          projectName={projectName}
          files={files}
          onOpenSettings={() => setEditing(true)}
        />
      ) : (
        <AiSettingsView s={s} onDone={() => void finishSettings()} onCancel={hasSlots ? () => setEditing(false) : undefined} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
