// src/components/ai/PlanCard.tsx
// بطاقة الخطة: الهدف، الخطوات مرقّمة (بتفاصيلها وملفاتها)، المخاطر، التحقق، وزرار نسخ.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { planToMarkdown, type Plan } from '../../ai/planFormat';

export default function PlanCard({ plan }: { plan: Plan }) {
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
    await Clipboard.setStringAsync(planToMarkdown(plan));
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.card}>
      {plan.goal ? (
        <View style={styles.section}>
          <Text style={styles.label}>{t('plan_goal')}</Text>
          <Text style={styles.goal} selectable>
            {plan.goal}
          </Text>
        </View>
      ) : null}

      {plan.steps.map((s, i) => (
        <View key={i} style={styles.step}>
          <View style={styles.num}>
            <Text style={styles.numText}>{i + 1}</Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle} selectable>
              {s.title}
            </Text>
            {s.details ? (
              <Text style={styles.stepDetails} selectable>
                {s.details}
              </Text>
            ) : null}
            {s.files.length ? (
              <View style={styles.chips}>
                {s.files.map((f, j) => (
                  <View key={j} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {f}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ))}

      {plan.risks.length ? (
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.warning }]}>{t('plan_risks')}</Text>
          {plan.risks.map((r, i) => (
            <Text key={i} style={styles.item} selectable>
              • {r}
            </Text>
          ))}
        </View>
      ) : null}

      {plan.checks.length ? (
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.success }]}>{t('plan_checks')}</Text>
          {plan.checks.map((c, i) => (
            <Text key={i} style={styles.item} selectable>
              • {c}
            </Text>
          ))}
        </View>
      ) : null}

      <TouchableOpacity style={styles.copyBtn} onPress={() => void copy()} activeOpacity={0.7}>
        <Text style={styles.copyText}>{copied ? t('ai_copied') : t('ai_copy')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  section: { gap: 2 },
  label: { color: colors.accent, fontFamily: fonts.uiSemibold, fontSize: 11.5 },
  goal: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 14, lineHeight: 22 },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  num: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  numText: { color: colors.text, fontFamily: fonts.codeBold, fontSize: 11 },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 13.5, lineHeight: 21 },
  stepDetails: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: {
    maxWidth: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipText: { color: colors.textMuted, fontFamily: fonts.code, fontSize: 10.5 },
  item: { color: colors.text, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 20 },
  copyBtn: { alignSelf: 'flex-end', paddingTop: spacing.xs },
  copyText: { color: colors.accent, fontFamily: fonts.uiMedium, fontSize: 11.5 },
});
