// src/components/ai/ContextPicker.tsx
// نافذة اختيار ملفات السياق: بحث + علامات اختيار (حد أقصى MAX_CONTEXT_FILES).
import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { MAX_CONTEXT_FILES } from '../../ai/contextFiles';
import type { PathEntry } from '../../ai/projectContext';

interface Props {
  visible: boolean;
  entries: PathEntry[];
  selected: string[]; // معرّفات الملفات المختارة
  onChange: (ids: string[]) => void;
  onClose: () => void;
}

export default function ContextPicker({ visible, entries, selected, onChange, onClose }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [warn, setWarn] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? entries.filter((e) => e.path.toLowerCase().includes(q)) : entries;
  }, [entries, query]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setWarn(false);
      onChange(selected.filter((x) => x !== id));
      return;
    }
    if (selected.length >= MAX_CONTEXT_FILES) {
      setWarn(true);
      return;
    }
    setWarn(false);
    onChange([...selected, id]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.bar}>
          <Text style={styles.title}>{t('ctx_title')}</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.done}>{t('ctx_done')}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t('ctx_search')}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.count, warn && { color: colors.warning }]}>
          {warn
            ? t('ctx_max').replace('{n}', String(MAX_CONTEXT_FILES))
            : t('ctx_selected').replace('{n}', String(selected.length))}
        </Text>

        <FlatList
          data={shown}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>{t('ctx_empty')}</Text>}
          renderItem={({ item }) => {
            const on = selected.includes(item.id);
            return (
              <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)} activeOpacity={0.7}>
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={on ? colors.accent : colors.textFaint}
                />
                <Text style={styles.path} numberOfLines={1}>
                  {item.path}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xl },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 16 },
  done: { color: colors.accent, fontFamily: fonts.uiSemibold, fontSize: 14 },
  search: {
    marginHorizontal: spacing.md,
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  count: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  empty: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 13, textAlign: 'center', marginTop: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  path: { flex: 1, color: colors.text, fontFamily: fonts.code, fontSize: 12 },
});
