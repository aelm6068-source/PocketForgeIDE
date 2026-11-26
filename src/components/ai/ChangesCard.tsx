// src/components/ai/ChangesCard.tsx
// كارت مراجعة تعديلات وضع التنفيذ: قايمة الملفات (جديد/تعديل/حذف) بعدد الأسطر، معاينة الفرق،
// واختيار الملفات الي هتتطبّق. بعد التطبيق بيعرض النتيجة وزرار تراجع.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { diffLines, previewLines, type DiffOp } from '../../ai/lineDiff';
import type { Proposal } from '../../ai/proposal';
import type { Change } from '../../ai/workspace';

interface Props {
  proposal: Proposal;
  canUndo: boolean;
  getChange: (path: string) => Change | undefined;
  onApply: (paths: string[]) => void;
  onReject: () => void;
  onUndo: () => void;
}

const KIND_KEY = { create: 'change_create', modify: 'change_modify', delete: 'change_delete' } as const;

function opsFor(c: Change): DiffOp[] | null {
  if (c.kind === 'create') return (c.after ?? '').split(/\r?\n/).map((text) => ({ op: '+' as const, text }));
  if (c.kind === 'delete') return (c.before ?? '').split(/\r?\n/).map((text) => ({ op: '-' as const, text }));
  return diffLines(c.before ?? '', c.after ?? '');
}

export default function ChangesCard({ proposal, canUndo, getChange, onApply, onReject, onUndo }: Props) {
  const { t } = useLanguage();
  const pending = proposal.status === 'pending';
  const [picked, setPicked] = useState<string[]>(() => proposal.items.map((i) => i.path));
  const [open, setOpen] = useState<string | null>(null);
  const chosen = picked.filter((p) => proposal.items.some((i) => i.path === p));

  const toggle = (p: string) => setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const preview = useMemo(() => {
    if (!open) return null;
    const c = getChange(open);
    if (!c) return { none: true as const };
    const ops = opsFor(c);
    return ops ? { none: false as const, ...previewLines(ops) } : { none: true as const };
  }, [open, getChange]);

  const tr = (k: string) => t(k as TranslationKey);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('agent_changes_title').replace('{n}', String(proposal.items.length))}</Text>

      {proposal.items.map((it) => (
        <View key={it.path} style={styles.item}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => (pending ? toggle(it.path) : setOpen(open === it.path ? null : it.path))}
            activeOpacity={0.7}
          >
            {pending ? (
              <Ionicons
                name={chosen.includes(it.path) ? 'checkbox' : 'square-outline'}
                size={19}
                color={chosen.includes(it.path) ? colors.accent : colors.textFaint}
              />
            ) : null}
            <Text style={[styles.kind, it.kind === 'delete' && styles.kindDel, it.kind === 'create' && styles.kindNew]}>
              {t(KIND_KEY[it.kind])}
            </Text>
            <Text style={styles.path} numberOfLines={1}>
              {it.path}
            </Text>
            <Text style={styles.add}>+{it.add}</Text>
            <Text style={styles.del}>-{it.del}</Text>
          </TouchableOpacity>

          {it.result ? <Text style={styles.result}>{tr(`agent_res_${it.result}`)}</Text> : null}

          <TouchableOpacity onPress={() => setOpen(open === it.path ? null : it.path)} activeOpacity={0.7}>
            <Text style={styles.link}>{t('agent_preview')}</Text>
          </TouchableOpacity>

          {open === it.path && preview ? (
            <View style={styles.diff}>
              {preview.none ? (
                <Text style={styles.diffNote}>{t('agent_preview_none')}</Text>
              ) : (
                <>
                  {preview.lines.map((l, i) => (
                    <Text key={i} style={[styles.dl, l.op === '+' && styles.dlAdd, l.op === '-' && styles.dlDel]} numberOfLines={2}>
                      {l.op}
                      {l.text}
                    </Text>
                  ))}
                  {preview.more > 0 ? <Text style={styles.diffNote}>{t('agent_preview_more').replace('{n}', String(preview.more))}</Text> : null}
                </>
              )}
            </View>
          ) : null}
        </View>
      ))}

      {pending ? (
        <View style={styles.btns}>
          <TouchableOpacity
            style={[styles.btn, styles.btnMain, chosen.length === 0 && styles.btnOff]}
            disabled={chosen.length === 0}
            onPress={() => onApply(chosen)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>{t('agent_apply').replace('{n}', String(chosen.length))}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={onReject} activeOpacity={0.8}>
            <Text style={styles.btnText}>{t('agent_reject')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.btns}>
          <Text style={styles.status}>
            {proposal.status === 'applied'
              ? t('agent_applied')
              : proposal.status === 'rejected'
                ? t('agent_rejected')
                : proposal.status === 'undone'
                  ? t('agent_undone')
                  : t('agent_expired')}
          </Text>
          {proposal.status === 'applied' && canUndo ? (
            <TouchableOpacity style={styles.btn} onPress={onUndo} activeOpacity={0.8}>
              <Text style={styles.btnText}>{t('agent_undo')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.uiSemibold, fontSize: 13 },
  item: { gap: 2, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  kind: { color: colors.warning, fontFamily: fonts.uiMedium, fontSize: 10.5 },
  kindNew: { color: colors.accent },
  kindDel: { color: colors.error },
  path: { flex: 1, color: colors.text, fontFamily: fonts.code, fontSize: 11.5 },
  add: { color: colors.accent, fontFamily: fonts.code, fontSize: 11 },
  del: { color: colors.error, fontFamily: fonts.code, fontSize: 11 },
  result: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 11 },
  link: { color: colors.accent, fontFamily: fonts.uiMedium, fontSize: 11 },
  diff: { backgroundColor: colors.background, borderRadius: radius.sm, padding: 6, gap: 1 },
  dl: { color: colors.textMuted, fontFamily: fonts.code, fontSize: 10.5, textAlign: 'left', writingDirection: 'ltr' },
  dlAdd: { color: colors.accent },
  dlDel: { color: colors.error },
  diffNote: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 11 },
  btns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  btn: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  btnMain: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  btnOff: { opacity: 0.45 },
  btnText: { color: colors.text, fontFamily: fonts.uiMedium, fontSize: 12 },
  status: { flex: 1, color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12 },
});
