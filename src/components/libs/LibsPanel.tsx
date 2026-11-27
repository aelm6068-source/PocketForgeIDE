// src/components/libs/LibsPanel.tsx
// تاب المكتبات: بحث في npm وإضافة مكتبة لـ package.json بتاع المشروع، وعرض/حذف المضافة.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { translate } from '../../i18n/translate';
import { VirtualFs } from '../../terminal/vfs';
import { createProjectStore } from '../../terminal/projectStore';
import { addLibrary, listLibraries, removeLibrary } from '../../libs/projectPkg';
import { LibError, searchPackages, type FetchFn, type SearchHit } from '../../libs/registry';
import { nameRisk, type DepEntry } from '../../libs/pkgJson';

type Tab = 'search' | 'installed';
const f = ((u: string, i?: any) => fetch(u, i)) as FetchFn;

function errText(e: unknown): string {
  if (e instanceof LibError) {
    const key = `libs_err_${e.code}` as Parameters<typeof translate>[0];
    return translate(key, { detail: e.message });
  }
  return translate('libs_err_network', { detail: 'unknown' });
}

export default function LibsPanel({ projectId }: { projectId: string }) {
  const { t } = useLanguage();
  const fs = useMemo(() => new VirtualFs(createProjectStore(projectId)), [projectId]);
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [deps, setDeps] = useState<DepEntry[]>([]);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const seq = useRef(0);

  const reload = useCallback(async () => {
    try {
      setDeps(await listLibraries(fs));
    } catch (e) {
      setDeps([]);
      setNote(errText(e));
    }
  }, [fs]);

  useEffect(() => {
    void reload();
  }, [reload, tab]);

  // بحث متأخر شوية (debounce) وبيتجاهل النتايج القديمة
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const my = ++seq.current;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchPackages(f, q);
        if (my === seq.current) {
          setHits(r);
          setNote('');
        }
      } catch (e) {
        if (my === seq.current) setNote(errText(e));
      } finally {
        if (my === seq.current) setSearching(false);
      }
    }, 450);
    return () => clearTimeout(id);
  }, [query]);

  const installed = useMemo(() => new Set(deps.map((d) => d.name)), [deps]);

  const add = async (name: string) => {
    setBusy(name);
    try {
      const r = await addLibrary(fs, f, name);
      let msg = t('libs_added').replace('{name}', r.name).replace('{range}', r.range);
      if (r.risk === 'native') msg += '\n' + t('libs_warn_native');
      else if (/^expo-/.test(r.name) && !r.sdkTagged) msg += '\n' + t('libs_warn_sdk');
      setNote(msg);
      await reload();
    } catch (e) {
      setNote(errText(e));
    } finally {
      setBusy('');
    }
  };

  const remove = async (name: string) => {
    setBusy(name);
    try {
      await removeLibrary(fs, name);
      setNote(t('libs_removed').replace('{name}', name));
      await reload();
    } catch (e) {
      setNote(errText(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>{t('libs_hint')}</Text>
      <View style={styles.tabs}>
        {(['search', 'installed'] as Tab[]).map((k) => (
          <TouchableOpacity key={k} style={[styles.chip, tab === k && styles.chipOn]} onPress={() => setTab(k)} activeOpacity={0.8}>
            <Text style={[styles.chipText, tab === k && styles.chipTextOn]}>
              {t(k === 'search' ? 'libs_tab_search' : 'libs_tab_installed')}
              {k === 'installed' && deps.length ? ` (${deps.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'search' ? (
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t('libs_search')}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}

      {tab === 'search' ? (
        <FlatList
          data={hits}
          keyExtractor={(h) => h.name}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searching ? (
              <ActivityIndicator style={styles.empty} color={colors.accent} />
            ) : (
              <Text style={styles.emptyText}>{query.trim() ? t('libs_no_results') : t('libs_empty_search')}</Text>
            )
          }
          renderItem={({ item }) => {
            const has = installed.has(item.name);
            return (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name} <Text style={styles.ver}>{item.version}</Text>
                    {nameRisk(item.name) === 'native' ? <Text style={styles.warn}>  {t('libs_badge_native')}</Text> : null}
                  </Text>
                  {item.description ? (
                    <Text style={styles.desc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[styles.btn, has && styles.btnOff]}
                  disabled={has || busy !== ''}
                  onPress={() => void add(item.name)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnText}>{busy === item.name ? t('libs_adding') : has ? t('libs_added_btn') : t('libs_add')}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={deps}
          keyExtractor={(d) => d.name}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('libs_none')}</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name} <Text style={styles.ver}>{item.range}</Text>
                  {item.dev ? <Text style={styles.ver}>  dev</Text> : null}
                </Text>
              </View>
              <TouchableOpacity style={styles.btnDanger} disabled={busy !== ''} onPress={() => void remove(item.name)} activeOpacity={0.8}>
                <Text style={styles.btnText}>{t('libs_remove')}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hint: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 11.5, lineHeight: 17, padding: spacing.md, paddingBottom: spacing.xs },
  tabs: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipText: { color: colors.textMuted, fontFamily: fonts.uiMedium, fontSize: 12 },
  chipTextOn: { color: colors.text },
  search: {
    marginHorizontal: spacing.md,
    color: colors.text,
    fontFamily: fonts.code,
    fontSize: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  note: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, lineHeight: 18, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  empty: { marginTop: spacing.xl },
  emptyText: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 13, textAlign: 'center', marginTop: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowInfo: { flex: 1, gap: 2 },
  name: { color: colors.text, fontFamily: fonts.code, fontSize: 13, textAlign: 'left' },
  ver: { color: colors.textMuted, fontFamily: fonts.code, fontSize: 11 },
  warn: { color: '#E0A33A', fontFamily: fonts.ui, fontSize: 11 },
  desc: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 12, lineHeight: 17 },
  btn: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent },
  btnOff: { opacity: 0.45 },
  btnDanger: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(220,70,90,0.18)', borderWidth: 1, borderColor: 'rgba(220,70,90,0.6)' },
  btnText: { color: colors.text, fontFamily: fonts.uiMedium, fontSize: 12 },
});
