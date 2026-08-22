// src/screens/editor/CodingKeyboard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../theme/colors';

export type KeyboardCommand =
  | 'backspace'
  | 'newline'
  | 'tab'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowUp'
  | 'arrowDown';

export type KeyboardMode = 'custom' | 'native';

interface CodingKeyboardProps {
  mode: KeyboardMode;
  collapsed: boolean;
  onToggleMode: () => void;
  onToggleCollapsed: () => void;
  onInsertText: (text: string) => void;
  onCommand: (command: KeyboardCommand) => void;
}

type Layer = 'letters' | 'symbols';

const LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const SYMBOL_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['(', ')', '{', '}', '[', ']', '"', "'", '`'],
  [';', ':', ',', '.', '/', '\\', '|', '<', '>'],
];

const QUICK_SYMBOLS = ['=', '+', '-', '_', '!', '?', '&', '%', '*'];

export default function CodingKeyboard({
  mode,
  collapsed,
  onToggleMode,
  onToggleCollapsed,
  onInsertText,
  onCommand,
}: CodingKeyboardProps) {
  const [layer, setLayer] = React.useState<Layer>('letters');
  const [isShifted, setIsShifted] = React.useState(false);

  const rows = layer === 'letters' ? LETTER_ROWS : SYMBOL_ROWS;

  const handleKeyPress = (key: string) => {
    const finalKey = layer === 'letters' && isShifted ? key.toUpperCase() : key;
    onInsertText(finalKey);
    if (isShifted) setIsShifted(false);
  };

  const showKeys = mode === 'custom' && !collapsed;

  return (
    <View style={styles.container}>
      {/* شريط علوي ثابت: تبديل كيبورد الموبايل / طي وفتح */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onToggleMode} activeOpacity={0.7}>
          <Ionicons
            name={mode === 'custom' ? 'code-slash-outline' : 'phone-portrait-outline'}
            size={14}
            color={colors.accent}
          />
          <Text style={styles.headerBtnText}>
            {mode === 'custom' ? 'كيبورد البرمجة' : 'كيبورد الموبايل'}
          </Text>
        </TouchableOpacity>

        {mode === 'custom' && (
          <TouchableOpacity style={styles.collapseBtn} onPress={onToggleCollapsed} activeOpacity={0.7}>
            <Ionicons
              name={collapsed ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {showKeys && (
        <>
          <View style={styles.quickRow}>
            {QUICK_SYMBOLS.map((sym) => (
              <TouchableOpacity
                key={sym}
                style={styles.quickKey}
                onPress={() => onInsertText(sym)}
                activeOpacity={0.6}
              >
                <Text style={styles.quickKeyText}>{sym}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.quickKey} onPress={() => onCommand('arrowLeft')} activeOpacity={0.6}>
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickKey} onPress={() => onCommand('arrowRight')} activeOpacity={0.6}>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>

          {rows.map((row, i) => (
            <View key={i} style={styles.row}>
              {i === 2 && layer === 'letters' && (
                <TouchableOpacity
                  style={[styles.specialKey, isShifted && styles.specialKeyActive]}
                  onPress={() => setIsShifted((v) => !v)}
                  activeOpacity={0.6}
                >
                  <Ionicons name="arrow-up" size={18} color={isShifted ? colors.accent : colors.text} />
                </TouchableOpacity>
              )}

              {row.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={styles.key}
                  onPress={() => handleKeyPress(key)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.keyText}>
                    {layer === 'letters' && isShifted ? key.toUpperCase() : key}
                  </Text>
                </TouchableOpacity>
              ))}

              {i === 2 && (
                <TouchableOpacity
                  style={styles.specialKey}
                  onPress={() => onCommand('backspace')}
                  activeOpacity={0.6}
                >
                  <Ionicons name="backspace-outline" size={18} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.switchKey}
              onPress={() => setLayer((l) => (l === 'letters' ? 'symbols' : 'letters'))}
              activeOpacity={0.6}
            >
              <Text style={styles.switchKeyText}>{layer === 'letters' ? '123' : 'ABC'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.specialKey}
              onPress={() => onCommand('tab')}
              activeOpacity={0.6}
            >
              <Text style={styles.keyText}>Tab</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.spaceKey}
              onPress={() => onInsertText(' ')}
              activeOpacity={0.6}
            >
              <Text style={styles.keyText}>مسافة</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.enterKey}
              onPress={() => onCommand('newline')}
              activeOpacity={0.6}
            >
              <Ionicons name="return-down-back" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  headerBtnText: {
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 12,
  },
  collapseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
    paddingBottom: 6,
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  quickKey: {
    flex: 1,
    height: 38,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickKeyText: {
    color: colors.accent,
    fontFamily: fonts.uiSemibold,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginBottom: 5,
  },
  key: {
    flex: 1,
    height: 46,
    maxWidth: 38,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 16,
  },
  specialKey: {
    width: 44,
    height: 46,
    backgroundColor: '#232030',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialKeyActive: {
    backgroundColor: colors.accent + '33',
  },
  switchKey: {
    width: 52,
    height: 46,
    backgroundColor: '#232030',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchKeyText: {
    color: colors.textMuted,
    fontFamily: fonts.uiSemibold,
    fontSize: 13,
  },
  spaceKey: {
    flex: 1,
    height: 46,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterKey: {
    width: 52,
    height: 46,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});