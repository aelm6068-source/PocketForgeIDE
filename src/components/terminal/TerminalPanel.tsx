// src/components/terminal/TerminalPanel.tsx
// شاشة الطرفية: مخرجات قابلة للتحديد (WebView) + سطر أوامر + أزرار نسخ + رموز سريعة.
// بتشتغل بالكامل على الجهاز فوق ملفات المشروع نفسها (نفس اللي شاشة الملفات بتعرضه).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { translate } from '../../i18n/translate';
import type { TranslationKey } from '../../i18n/translations';
import { Shell } from '../../terminal/shell';
import { VirtualFs } from '../../terminal/vfs';
import { createProjectStore } from '../../terminal/projectStore';
import type { Tr } from '../../terminal/types';
import { TERMINAL_HTML } from './terminalHtml';
import { useJsRunner } from './useJsRunner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Entry = { k: 'cmd' | 'out' | 'err' | 'info'; t: string; p?: string };

const MAX_ENTRIES = 3000;
// مسافة إضافية فوق الكيبورد (بتعوّض شريط التنقل اللي أندرويد مبيحسبوش). لو الخانة لسه ناقصة زوّد الرقم، ولو بعيدة قلّله
const KB_EXTRA = 36;
const QUICK_KEYS = ['/', '-', '.', '~', '*', '>', '|', '&&', ';', '"'];

// الشِل بيبعت مفاتيح نصية عامة، والترجمة بتتم هنا بدالة translate اللي بتدعم {path} و{cmd}
const tr: Tr = (key, params) => translate(key as TranslationKey, params);

// JSON.stringify ما بيهربش الرمزين U+2028/U+2029 وده ممكن يكسر السكربت المحقون،
// فبنبدلهم بنص هروب صريح (بنبني الرموز بـ fromCharCode عشان الملف يفضل ASCII واضح)
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const BACKSLASH = String.fromCharCode(92);
function toJs(value: unknown): string {
  return JSON.stringify(value)
    .split(LINE_SEP)
    .join(BACKSLASH + 'u2028')
    .split(PARA_SEP)
    .join(BACKSLASH + 'u2029');
}

export default function TerminalPanel({ projectId }: { projectId: string }) {
  const { t } = useLanguage();

    const js = useJsRunner();

  const shell = useMemo(
    () => new Shell(new VirtualFs(createProjectStore(projectId)), tr, '/', js.runner),
    [projectId, js.runner]
  );

  const webRef = useRef<WebView>(null);
  const inputRef = useRef<TextInput>(null);
  const readyRef = useRef(false);
  const entriesRef = useRef<Entry[]>([{ k: 'info', t: t('term_ui_welcome') }]);
  const histIdxRef = useRef(-1);
  const selRef = useRef({ start: 0, end: 0 });
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('/');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [forcedSel, setForcedSel] = useState<{ start: number; end: number } | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const inject = useCallback((code: string) => {
    webRef.current?.injectJavaScript(`${code};true;`);
  }, []);

  const push = useCallback(
    (items: Entry[]) => {
      if (!items.length) return;
      const all = entriesRef.current;
      all.push(...items);
      if (all.length > MAX_ENTRIES) all.splice(0, all.length - MAX_ENTRIES);
      if (readyRef.current) inject(`window.term&&window.term.add(${toJs(items)})`);
    },
    [inject]
  );

  const clearAll = useCallback(() => {
    entriesRef.current = [];
    if (readyRef.current) inject('window.term&&window.term.clear()');
  }, [inject]);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 1500);
  }, []);

  const onMessage = useCallback(
    (e: { nativeEvent: { data: string } }) => {
      if (e.nativeEvent.data === 'ready') {
        readyRef.current = true;
        inject(`window.term&&window.term.reset(${toJs(entriesRef.current)})`);
      }
    },
    [inject]
  );

  const submit = useCallback(
    async (raw: string) => {
      const line = raw.trim();
      if (busy || !line) return;
      setInput('');
      histIdxRef.current = -1;
      push([{ k: 'cmd', p: `${shell.cwd} $`, t: line }]);
      setBusy(true);
            // المخرجات بتظهر لحظة بلحظة (بتتجمّع كل 60ms عشان ما نحقنش الـ WebView سطر سطر)
      let buf: Entry[] = [];
      let timer: ReturnType<typeof setTimeout> | null = null;
      const flush = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (buf.length) {
          const batch = buf;
          buf = [];
          push(batch);
        }
      };
      try {
        const res = await shell.run(line, (l) => {
          buf.push({ k: l.kind, t: l.text });
          if (!timer) timer = setTimeout(flush, 60);
        });
        flush();
        if (res.clear) clearAll();
        setCwd(shell.cwd);
      } catch (err: any) {
        flush();
        push([{ k: 'err', t: String(err?.message ?? err) }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, shell, push, clearAll]
  );

  const stepHistory = useCallback(
    (dir: -1 | 1) => {
      const h = shell.history;
      if (!h.length) return;
      let idx = histIdxRef.current;
      if (dir === -1) idx = idx === -1 ? h.length - 1 : Math.max(0, idx - 1);
      else idx = idx === -1 ? -1 : idx + 1 >= h.length ? -1 : idx + 1;
      histIdxRef.current = idx;
      const next = idx === -1 ? '' : h[idx];
      setInput(next);
      setForcedSel({ start: next.length, end: next.length });
    },
    [shell]
  );

  const insertKey = useCallback(
    (key: string) => {
      const s = Math.min(selRef.current.start, selRef.current.end);
      const e = Math.max(selRef.current.start, selRef.current.end);
      const text = input.slice(0, s) + key + input.slice(e);
      const pos = s + key.length;
      setInput(text);
      setForcedSel({ start: pos, end: pos });
      inputRef.current?.focus();
    },
    [input]
  );

  const copyText = useCallback(
    async (text: string) => {
      if (!text) {
        showNotice(t('term_ui_nothing_to_copy'));
        return;
      }
      try {
        await Clipboard.setStringAsync(text);
        showNotice(t('term_ui_copied'));
      } catch {
        showNotice(t('term_ui_nothing_to_copy'));
      }
    },
    [showNotice, t]
  );

  const copyLast = useCallback(() => {
    const all = entriesRef.current;
    let lastCmd = -1;
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].k === 'cmd') {
        lastCmd = i;
        break;
      }
    }
    const block = lastCmd === -1 ? [] : all.slice(lastCmd + 1);
    copyText(block.map((x) => x.t).join('\n'));
  }, [copyText]);

  const copyAll = useCallback(() => {
    const text = entriesRef.current
      .map((x) => (x.k === 'cmd' ? `${x.p ?? '$'} ${x.t}` : x.t))
      .join('\n');
    copyText(text);
  }, [copyText]);
     const rootRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const [kbPad, setKbPad] = useState(0);
  useEffect(() => {
    const measure = (screenY: number) => {
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        const overlap = Math.round(y + h - screenY);
                setKbPad(overlap > 0 ? overlap + Math.max(insets.bottom, KB_EXTRA) : 0);
      });
    };
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      measure(e.endCoordinates.screenY);
      setTimeout(() => measure(e.endCoordinates.screenY), 150);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [insets.bottom]);
  return (
        <View ref={rootRef} style={[styles.container, { paddingBottom: kbPad }]}>
      {/* شريط الأدوات */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={copyLast} activeOpacity={0.7}>
          <Ionicons name="copy-outline" size={15} color={colors.textMuted} />
          <Text style={styles.toolText} numberOfLines={1}>{t('term_ui_copy_last')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={copyAll} activeOpacity={0.7}>
          <Ionicons name="documents-outline" size={15} color={colors.textMuted} />
          <Text style={styles.toolText} numberOfLines={1}>{t('term_ui_copy_all')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={clearAll} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
          <Text style={styles.toolText} numberOfLines={1}>{t('term_ui_clear')}</Text>
        </TouchableOpacity>
      </View>

      {/* المخرجات (قابلة للتحديد والنسخ) */}
      <View style={styles.outputWrap}>
        <WebView
          ref={webRef}
          source={{ html: TERMINAL_HTML }}
          originWhitelist={['*']}
          javaScriptEnabled
          onMessage={onMessage}
          style={styles.web}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          allowFileAccess={false}
          showsVerticalScrollIndicator
        />
        {notice ? (
          <View style={styles.notice} pointerEvents="none">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
      </View>

      {/* رموز سريعة + أسهم السجل */}
      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.arrowBtn} onPress={() => stepHistory(-1)} activeOpacity={0.7}>
          <Ionicons name="arrow-up" size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.arrowBtn} onPress={() => stepHistory(1)} activeOpacity={0.7}>
          <Ionicons name="arrow-down" size={16} color={colors.text} />
        </TouchableOpacity>
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.keysContent}
        >
          {QUICK_KEYS.map((k) => (
            <TouchableOpacity key={k} style={styles.keyBtn} onPress={() => insertKey(k)} activeOpacity={0.7}>
              <Text style={styles.keyText}>{k}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* سطر الأوامر */}
      <View style={styles.inputRow}>
        <Text style={styles.prompt} numberOfLines={1} ellipsizeMode="head">{cwd} $</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={(v) => {
            histIdxRef.current = -1;
            setInput(v);
          }}
          selection={forcedSel}
          onSelectionChange={(e) => {
            selRef.current = e.nativeEvent.selection;
            if (forcedSel) setForcedSel(undefined);
          }}
          onSubmitEditing={() => submit(input)}
          placeholder={t('term_ui_placeholder')}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType="send"
          blurOnSubmit={false}
        />
                <TouchableOpacity
          style={[styles.sendBtn, busy && { backgroundColor: colors.error }]}
          onPress={() => (busy ? js.stop() : submit(input))}
          activeOpacity={0.7}
        >
          <Ionicons name={busy ? 'stop' : 'return-down-forward'} size={18} color="white" />
        </TouchableOpacity>
      </View>
       {js.element}   
        </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A10' },
  toolbar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  toolText: { fontSize: 11, color: colors.textMuted, fontFamily: fonts.uiSemibold, flexShrink: 1 },
  outputWrap: { flex: 1 },
  web: { flex: 1, backgroundColor: '#0B0A10' },
  notice: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  noticeText: { color: colors.text, fontSize: 12, fontFamily: fonts.uiSemibold },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  arrowBtn: {
    width: 34,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  keysContent: { gap: 6, alignItems: 'center' },
  keyBtn: {
    minWidth: 34,
    height: 32,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  keyText: { color: colors.text, fontSize: 14, fontFamily: fonts.codeMedium },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: 2,
  },
  prompt: { maxWidth: '38%', color: colors.success, fontSize: 13, fontFamily: fonts.codeBold },
  input: {
    flex: 1,
    height: 40,
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.code,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  sendBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
});