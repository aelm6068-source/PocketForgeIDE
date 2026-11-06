// src/components/ai/MessageText.tsx
// عرض رد الذكاء الاصطناعي: نص منسّق (عناوين/قوايم/عريض/كود سطري) + مربعات كود بزرار نسخ لكل مربع.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { parseBlocks, parseLine } from '../../ai/markdown';

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };
  return (
    <View style={styles.codeBox}>
      <View style={styles.codeHead}>
        <Text style={styles.codeLang}>{lang || 'code'}</Text>
        <TouchableOpacity onPress={() => void copy()} activeOpacity={0.7}>
          <Text style={styles.copyText}>{copied ? t('ai_copied') : t('ai_copy')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.code} selectable>
        {code}
      </Text>
    </View>
  );
}

export default function MessageText({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        if (b.type === 'code') return <CodeBlock key={i} code={b.code} lang={b.lang} />;
        const lines = b.text.split('\n');
        return (
          <Text key={i} style={styles.msg} selectable>
            {lines.map((line, li) => (
              <Text key={li}>
                {parseLine(line).map((sp, si) => (
                  <Text key={si} style={[sp.bold && styles.bold, sp.code && styles.inlineCode]}>
                    {sp.text}
                  </Text>
                ))}
                {li < lines.length - 1 ? '\n' : ''}
              </Text>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  msg: { color: colors.text, fontFamily: fonts.ui, fontSize: 13.5, lineHeight: 21 },
  bold: { fontFamily: fonts.uiSemibold },
  inlineCode: { fontFamily: fonts.code, fontSize: 12.5, color: colors.accent, backgroundColor: colors.surfaceElevated },
  codeBox: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  codeHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surfaceElevated,
  },
  codeLang: { color: colors.textMuted, fontFamily: fonts.code, fontSize: 11 },
  copyText: { color: colors.accent, fontFamily: fonts.uiMedium, fontSize: 11.5 },
  code: {
    color: colors.text,
    fontFamily: fonts.code,
    fontSize: 12,
    lineHeight: 18,
    padding: spacing.sm,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});