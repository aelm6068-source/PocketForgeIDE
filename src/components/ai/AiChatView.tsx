// src/components/ai/AiChatView.tsx
// محادثة الذكاء الاصطناعي: وضع دردشة/خطة، اختيار ملفات سياق، رسايل قابلة للتحديد والنسخ + خانة كتابة.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAiChat } from '../../ai/useAiChat';
import type { UiMessage } from '../../ai/useAiChat';
import type { RouteFn, RouteStepFn } from '../../ai/useAiChat';
import type { TranslationKey } from '../../i18n/translations';
import type { ChatMode } from '../../ai/chatRequest';
import { splitPlanReply } from '../../ai/planFormat';
import type { ProjectFile } from '../../screens/editor/useEditorFile';
import { useKeyboardPad } from '../../ai/useKeyboardPad';
import MessageText from './MessageText';
import PlanCard from './PlanCard';
import ContextPicker from './ContextPicker';

interface Props {
  projectId: string;
  route: RouteFn;
  routeStep: RouteStepFn;
  headerLabel: string; // اسم الخانة الأساسية (+ عدد الباقي)
  projectName: string;
  files: ProjectFile[];
  onOpenSettings: () => void;
  onOpenSlots: () => void;
}

export default function AiChatView({ projectId, route, routeStep, headerLabel, projectName, files, onOpenSettings, onOpenSlots }: Props) {
  const { t } = useLanguage();
  const { rootRef, pad } = useKeyboardPad();
  const chat = useAiChat(projectId, route, routeStep, projectName, files);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('chat');
  const [ctxIds, setCtxIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toolsOn, setToolsOn] = useState(false); // قراءة ملفات المشروع (مقفولة افتراضيًا)
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

  // لو المشروع اتغير نفضّي الاختيار (المعرّفات خاصة بمشروع)
  useEffect(() => {
    setCtxIds([]);
  }, [projectId]);

  const pathById = new Map<string, string>(chat.entries.map((e) => [e.id, e.path]));
  const selected = ctxIds.filter((id) => pathById.has(id));

  const submit = () => {
    const text = input.trim();
    if (!text || chat.sending || !chat.loaded) return;
    setInput('');
    setCtxIds([]); // الملفات بتتبعت مع الرسالة دي بس
    void chat.send(text, { mode, contextIds: selected, tools: toolsOn });
  };

  const copy = async (m: UiMessage) => {
    await Clipboard.setStringAsync(m.content);
    setCopiedId(m.id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1500);
  };

  const renderAssistant = (m: UiMessage) => {
    if (m.mode !== 'plan') return <MessageText text={m.content} />;
    const { plan, text } = splitPlanReply(m.content);
    if (!plan) {
      return (
        <View style={styles.planWrap}>
          <Text style={styles.warn}>{t('plan_unparsed')}</Text>
          <MessageText text={m.content} />
        </View>
      );
    }
    return (
      <View style={styles.planWrap}>
        {text ? <MessageText text={text} /> : null}
        <PlanCard plan={plan} />
      </View>
    );
  };

  const toolLabel = (name: string): string => {
    const k = `tool_${name}` as TranslationKey;
    const v = t(k);
    return v === k ? name : v;
  };

  const canSend = !!input.trim() && !chat.sending && chat.loaded;

  return (
    <View ref={rootRef} style={[styles.root, { paddingBottom: pad }]}>
      <View style={styles.bar}>
        <Text style={styles.barTitle} numberOfLines={1}>
          {t('ai_chat_title')} · {headerLabel}
        </Text>
        <TouchableOpacity style={styles.barBtn} onPress={chat.clear} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={onOpenSlots} activeOpacity={0.7}>
          <Ionicons name="key-outline" size={18} color={colors.text} />
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
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.mine : styles.theirs,
              item.mode === 'plan' && item.role === 'assistant' && styles.planBubble,
              item.failed && styles.failed,
            ]}
          >
            {item.role === 'assistant' ? (
              renderAssistant(item)
            ) : (
              <View>
                <Text style={styles.msg} selectable>
                  {item.content}
                </Text>
                {item.ctx?.length ? (
                  <Text style={styles.ctxLine} numberOfLines={2}>
                    {t('ctx_sent').replace('{files}', item.ctx.join(', '))}
                  </Text>
                ) : null}
              </View>
            )}
            {item.role === 'assistant' && item.tools?.length ? (
              <View style={styles.toolRow}>
                {item.tools.map((tr, i) => (
                  <Text key={i} style={[styles.toolChip, !tr.ok && styles.toolChipFail]} numberOfLines={1}>
                    {toolLabel(tr.name)}
                    {tr.arg ? ` ${tr.arg}` : ''}
                  </Text>
                ))}
                {item.capped ? <Text style={styles.notice}>{t('tools_capped')}</Text> : null}
              </View>
            ) : null}
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
                <Text style={styles.thinkingText} numberOfLines={1}>
                  {chat.activity ? `${toolLabel(chat.activity.name)} ${chat.activity.arg}` : t('ai_thinking')}
                </Text>
              </View>
            ) : null}
            {chat.skipped > 0 ? (
              <Text style={styles.notice}>{t('ctx_skipped').replace('{n}', String(chat.skipped))}</Text>
            ) : null}
            {chat.error ? <Text style={styles.err}>{chat.error}</Text> : null}
          </View>
        }
      />

      <View style={styles.tools}>
        <View style={styles.modes}>
          {(['chat', 'plan'] as ChatMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeChip, mode === m && styles.modeChipOn]}
              onPress={() => setMode(m)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>
                {t(m === 'chat' ? 'mode_chat' : 'mode_plan')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.attachBtn, toolsOn && styles.modeChipOn]}
          onPress={() => setToolsOn((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="search-outline" size={16} color={colors.text} />
          <Text style={styles.attachText}>{t('tools_toggle')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
          <Ionicons name="document-attach-outline" size={16} color={colors.text} />
          <Text style={styles.attachText}>
            {t('ctx_attach')}
            {selected.length ? ` (${selected.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {toolsOn ? <Text style={styles.toolHint}>{t('tools_hint')}</Text> : null}

      {selected.length ? (
        <View style={styles.selRow}>
          {selected.map((id) => (
            <TouchableOpacity
              key={id}
              style={styles.selChip}
              onPress={() => setCtxIds(selected.filter((x) => x !== id))}
              activeOpacity={0.7}
            >
              <Text style={styles.selText} numberOfLines={1}>
                {pathById.get(id)}
              </Text>
              <Ionicons name="close" size={12} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t(mode === 'plan' ? 'plan_placeholder' : 'ai_chat_placeholder')}
          placeholderTextColor={colors.textFaint}
          multiline
        />
        <TouchableOpacity
          style={[styles.send, !canSend && styles.sendOff]}
          onPress={submit}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ContextPicker
        visible={pickerOpen}
        entries={chat.entries}
        selected={selected}
        onChange={setCtxIds}
        onClose={() => setPickerOpen(false)}
      />
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
  planBubble: { maxWidth: '100%', alignSelf: 'stretch' },
  failed: { borderColor: colors.error },
  msg: { color: colors.text, fontFamily: fonts.ui, fontSize: 13.5, lineHeight: 21 },
  ctxLine: { color: colors.textMuted, fontFamily: fonts.code, fontSize: 10.5, marginTop: spacing.xs },
  planWrap: { gap: spacing.sm },
  warn: { color: colors.warning, fontFamily: fonts.ui, fontSize: 12, lineHeight: 18 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  via: { flex: 1, color: colors.textFaint, fontFamily: fonts.code, fontSize: 10.5 },
  copyText: { color: colors.accent, fontFamily: fonts.uiMedium, fontSize: 11.5 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  thinkingText: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12.5 },
  notice: { color: colors.warning, fontFamily: fonts.ui, fontSize: 12, lineHeight: 18, padding: spacing.sm },
  err: { color: colors.error, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 19, padding: spacing.sm },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modes: { flexDirection: 'row', gap: spacing.xs },
  modeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeChipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  modeText: { color: colors.textMuted, fontFamily: fonts.uiMedium, fontSize: 12 },
  modeTextOn: { color: colors.text },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  attachText: { color: colors.text, fontFamily: fonts.uiMedium, fontSize: 12 },
  toolRow: { gap: 3, marginTop: spacing.xs },
  toolChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    color: colors.textMuted,
    fontFamily: fonts.code,
    fontSize: 10.5,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  toolChipFail: { color: colors.warning },
  toolHint: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 11.5, lineHeight: 17, paddingHorizontal: spacing.sm + 2, paddingTop: spacing.xs },
  selRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  selChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  selText: { flexShrink: 1, color: colors.textMuted, fontFamily: fonts.code, fontSize: 10.5 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
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
