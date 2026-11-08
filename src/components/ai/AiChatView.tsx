// src/components/ai/AiChatView.tsx
// محادثة الذكاء الاصطناعي: رسايل قابلة للتحديد والنسخ + خانة كتابة.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAiChat } from '../../ai/useAiChat';
import type { UiMessage } from '../../ai/useAiChat';
import type { RouteFn } from '../../ai/useAiChat';
import type { ProjectFile } from '../../screens/editor/useEditorFile';
import { useKeyboardPad } from '../../ai/useKeyboardPad';
import MessageText from './MessageText';

interface Props {
  projectId: string;
  route: RouteFn;
  headerLabel: string; // اسم الخانة الأساسية (+ عدد الباقي)
  projectName: string;
  files: ProjectFile[];
  onOpenSettings: () => void;
}

export default function AiChatView({ projectId, route, headerLabel, projectName, files, onOpenSettings }: Props) {
  const { t } = useLanguage();
  const { rootRef, pad } = useKeyboardPad();
  const chat = useAiChat(projectId, route, projectName, files);
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const listRef = useRef<FlatList<UiMessage>>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );
  useEffect(() => {
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [chat.messages.length, chat.sending]);

  const submit = () => {
    const text = input.trim();
    if (!text || chat.sending || !chat.loaded) return;
    setInput('');
    void chat.send(text);
  };

  const copy = async (m: UiMessage) => {
    await Clipboard.setStringAsync(m.content);
    setCopiedId(m.id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <View ref={rootRef} style={[styles.root, { paddingBottom: pad }]}>
      <View style={styles.bar}>
        <Text style={styles.barTitle} numberOfLines={1}>
          {t('ai_chat_title')} · {headerLabel}
        </Text>
        <TouchableOpacity style={styles.barBtn} onPress={chat.clear} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={onOpenSettings} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={chat.messages}
        keyExtractor={(m) => String(m.id)}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{t('ai_chat_empty')}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.mine : styles.theirs, item.failed && styles.failed]}>
            {item.role === 'assistant' ? (
              <MessageText text={item.content} />
            ) : (
              <Text style={styles.msg} selectable>
                {item.content}
              </Text>
            )}
            {item.role === 'assistant' ? (
              <View style={styles.footerRow}>
                <Text style={styles.via} numberOfLines={1}>
                  {item.via || ''}
                </Text>
                <TouchableOpacity onPress={() => void copy(item)} activeOpacity={0.7}>
                  <Text style={styles.copyText}>{copiedId === item.id ? t('ai_copied') : t('ai_copy')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
        ListFooterComponent={
          <View>
            {chat.sending ? (
              <View style={styles.thinking}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.thinkingText}>{t('ai_thinking')}</Text>
              </View>
            ) : null}
            {chat.error ? <Text style={styles.err}>{chat.error}</Text> : null}
          </View>
        }
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t('ai_chat_placeholder')}
          placeholderTextColor={colors.textFaint}
          multiline
        />
        <TouchableOpacity
          style={[styles.send, (!input.trim() || chat.sending || !chat.loaded) && styles.sendOff]}
          onPress={submit}
          disabled={!input.trim() || chat.sending || !chat.loaded}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  barTitle: { flex: 1, color: colors.textMuted, fontFamily: fonts.code, fontSize: 11.5 },
  barBtn: { padding: spacing.xs },
  list: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  empty: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: spacing.xl },
  bubble: { maxWidth: '92%', borderRadius: radius.md, padding: spacing.sm + 2, borderWidth: 1 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accentDim, borderColor: colors.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border },
  failed: { borderColor: colors.error },
  msg: { color: colors.text, fontFamily: fonts.ui, fontSize: 13.5, lineHeight: 21 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  via: { flex: 1, color: colors.textFaint, fontFamily: fonts.code, fontSize: 10.5 },
  copyText: { color: colors.accent, fontFamily: fonts.uiMedium, fontSize: 11.5 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  thinkingText: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12.5 },
  err: { color: colors.error, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 19, padding: spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
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
  send: { backgroundColor: colors.accent, borderRadius: radius.pill, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.45 },
});