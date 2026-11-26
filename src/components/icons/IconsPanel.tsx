// src/components/icons/IconsPanel.tsx
// تاب مكتبة الأيقونات: اختيار مجموعة، بحث، شبكة أيقونات، وتفاصيل أيقونة مع نسخ الكود.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { filterIcons, importLine, jsxSnippet, ICON_SETS, MAX_SHOWN, type IconSetId } from '../../icons/iconMeta';
import { iconComponent, iconNames } from '../../icons/iconSets';

const COLS = 4;

export default function IconsPanel() {
  const { t } = useLanguage();
  const [setId, setSetId] = useState<IconSetId>('Ionicons');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const Comp = iconComponent(setId);
  const all = useMemo(() => iconNames(setId), [setId]);
  const found = useMemo(() => filterIcons(all, query), [all, query]);
  const shown = found.length > MAX_SHOWN ? found.slice(0, MAX_SHOWN) : found;

  const copy = async (key: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(''), 1500);
  };
  const label = (key: string, text: string) => (copied === key ? t('icons_copied') : text);

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>{t('icons_hint')}</Text>

      <View style={styles.sets}>
        {ICON_SETS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.setChip, setId === s.id && styles.setChipOn]}
            onPress={() => setSetId(s.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.setText, setId === s.id && styles.setTextOn]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('icons_search')}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.count}>
        {found.length > MAX_SHOWN
          ? t('icons_more').replace('{n}', String(MAX_SHOWN))
          : t('icons_count').replace('{n}', String(found.length))}
      </Text>

      <FlatList
        key={setId}
        data={shown}
        numColumns={COLS}
        keyExtractor={(n) => n}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={40}
        windowSize={7}
        ListEmptyComponent={<Text style={styles.empty}>{t('icons_empty')}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.cell} onPress={() => setPicked(item)} activeOpacity={0.7}>
            <Comp name={item} size={26} color={colors.text} />
            <Text style={styles.cellName} numberOfLines={1}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!picked} transparent animationType="fade" onRequestClose={() => setPicked(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPicked(null)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            {picked ? (
              <>
                <Comp name={picked} size={56} color={colors.text} />
                <Text style={styles.pName} selectable>
                  {picked}
                </Text>
                <Text style={styles.pCode} selectable>
                  {jsxSnippet(setId, picked)}
                </Text>
                <View style={styles.pBtns}>
                  <TouchableOpacity style={styles.pBtn} onPress={() => void copy('jsx', `${jsxSnippet(setId, picked)}`)}>
                    <Text style={styles.pBtnText}>{label('jsx', t('icons_copy_jsx'))}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pBtn} onPress={() => void copy('imp', importLine(setId))}>
                    <Text style={styles.pBtnText}>{label('imp', t('icons_copy_import'))}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pBtn} onPress={() => void copy('name', picked)}>
                    <Text style={styles.pBtnText}>{label('name', t('icons_copy_name'))}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setPicked(null)}>
                  <Text style={styles.close}>{t('icons_close')}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hint: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 11.5, lineHeight: 17, padding: spacing.md, paddingBottom: spacing.xs },
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  setChip: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  setChipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  setText: { color: colors.textMuted, fontFamily: fonts.uiMedium, fontSize: 12 },
  setTextOn: { color: colors.text },
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
  cell: { flex: 1 / COLS, alignItems: 'center', gap: 6, paddingVertical: spacing.md, paddingHorizontal: 2 },
  cellName: { color: colors.textMuted, fontFamily: fonts.code, fontSize: 9.5, maxWidth: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  pName: { color: colors.text, fontFamily: fonts.code, fontSize: 14 },
  pCode: { color: colors.textMuted, fontFamily: fonts.code, fontSize: 11, textAlign: 'left', writingDirection: 'ltr' },
  pBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.xs },
  pBtn: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent },
  pBtnText: { color: colors.text, fontFamily: fonts.uiMedium, fontSize: 12 },
  close: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12.5, marginTop: spacing.xs },
});
