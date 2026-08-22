// src/screens/editor/EditorSearchBar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import type { SearchResult } from './useEditorState';

interface EditorSearchBarProps {
  visible: boolean;
  searchResult: SearchResult;
  onSearch: (query: string, caseSensitive: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onGotoLine: (lineNumber: number) => void;
  onClose: () => void;
}

// بيتحقق هل النص المدخل رقم بحت (يعني المستخدم عايز يروح لسطر معين)
function isPureNumber(text: string): boolean {
  return /^\d+$/.test(text.trim());
}

export default function EditorSearchBar({
  visible,
  searchResult,
  onSearch,
  onNext,
  onPrev,
  onGotoLine,
  onClose,
}: EditorSearchBarProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (isPureNumber(text) && text.trim().length > 0) {
      // وضع "روح لسطر" - مفيش داعي بحث نصي
      return;
    }

    debounceRef.current = setTimeout(() => {
      onSearch(text, caseSensitive);
    }, 250);
  };

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (isPureNumber(trimmed)) {
      onGotoLine(parseInt(trimmed, 10));
    } else {
      onSearch(trimmed, caseSensitive);
    }
  };

  if (!visible) return null;

  const isLineMode = isPureNumber(query) && query.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <Ionicons
          name={isLineMode ? 'return-down-forward-outline' : 'search'}
          size={16}
          color={colors.textMuted}
        />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          onSubmitEditing={handleSubmit}
          placeholder="ابحث في الكود، أو اكتب رقم سطر..."
          placeholderTextColor={colors.textFaint}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actions}>
        {isLineMode ? (
          <TouchableOpacity style={styles.gotoBtn} onPress={handleSubmit} activeOpacity={0.75}>
            <Text style={styles.gotoBtnText}>روح لسطر {query.trim()}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.counter}>
              {searchResult.total > 0 ? `${searchResult.index}/${searchResult.total}` : 'مفيش نتائج'}
            </Text>

            <TouchableOpacity
              style={[styles.caseBtn, caseSensitive && styles.caseBtnActive]}
              onPress={() => {
                const next = !caseSensitive;
                setCaseSensitive(next);
                if (query) onSearch(query, next);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.caseBtnText, caseSensitive && styles.caseBtnTextActive]}>Aa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navBtn}
              onPress={onPrev}
              disabled={searchResult.total === 0}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-up" size={16} color={searchResult.total ? colors.text : colors.textFaint} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={onNext}
              disabled={searchResult.total === 0}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-down" size={16} color={searchResult.total ? colors.text : colors.textFaint} />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    height: 36,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 13,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counter: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  caseBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseBtnActive: {
    backgroundColor: colors.accent + '33',
  },
  caseBtnText: {
    color: colors.textMuted,
    fontFamily: fonts.uiSemibold,
    fontSize: 11,
  },
  caseBtnTextActive: {
    color: colors.accent,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotoBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  gotoBtnText: {
    color: 'white',
    fontFamily: fonts.uiSemibold,
    fontSize: 12,
  },
});