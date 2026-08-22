// src/screens/SettingsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme/colors';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>الإعدادات</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
  },
});