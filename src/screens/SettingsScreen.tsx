// src/screens/SettingsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { testDaytonaConnection } from '../utils/daytonaClient';

type Provider = 'e2b' | 'daytona';

const STORAGE_KEYS = {
  e2bKey: 'pocketforge_apikey_e2b',
  daytonaKey: 'pocketforge_apikey_daytona',
  activeProvider: 'pocketforge_activeProvider',
};

const PROVIDER_INFO: Record<
  Provider,
  { label: string; signupUrl: string; placeholder: string }
> = {
  e2b: {
    label: 'E2B',
    signupUrl: 'https://e2b.dev/dashboard',
    placeholder: 'e2b_...',
  },
  daytona: {
    label: 'Daytona',
    signupUrl: 'https://app.daytona.io/',
    placeholder: 'dtn_...',
  },
};

export default function SettingsScreen() {
  const [e2bKey, setE2bKey] = useState('');
  const [daytonaKey, setDaytonaKey] = useState('');
  const [showE2b, setShowE2b] = useState(false);
  const [showDaytona, setShowDaytona] = useState(false);
  const [activeProvider, setActiveProvider] = useState<Provider>('daytona');
  const [savedFlag, setSavedFlag] = useState<Provider | null>(null);
  const [testingProvider, setTestingProvider] = useState<Provider | null>(null);
  const [testResult, setTestResult] = useState<{
    provider: Provider;
    success: boolean;
    message: string;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expoToken, setExpoToken] = useState('');
  const [showExpoToken, setShowExpoToken] = useState(false);
  const [expoTokenSaved, setExpoTokenSaved] = useState(false);

  // تحميل القيم المحفوظة عند فتح الشاشة
  useEffect(() => {
    (async () => {
      try {
        const [storedE2b, storedDaytona, storedActive, storedExpoToken] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEYS.e2bKey),
          SecureStore.getItemAsync(STORAGE_KEYS.daytonaKey),
          SecureStore.getItemAsync(STORAGE_KEYS.activeProvider),
          SecureStore.getItemAsync('pocketforge_apikey_expo'),
        ]);
        if (storedE2b) setE2bKey(storedE2b);
        if (storedDaytona) setDaytonaKey(storedDaytona);
        if (storedActive === 'e2b' || storedActive === 'daytona') {
          setActiveProvider(storedActive);
        }
        if (storedExpoToken) setExpoToken(storedExpoToken);
      } catch (err) {
        console.warn('فشل تحميل المفاتيح المحفوظة', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const handleSaveKey = useCallback(async (provider: Provider) => {
    const value = provider === 'e2b' ? e2bKey : daytonaKey;
    const storageKey =
      provider === 'e2b' ? STORAGE_KEYS.e2bKey : STORAGE_KEYS.daytonaKey;

    if (!value.trim()) {
      Alert.alert('تنبيه', 'من فضلك أدخل المفتاح قبل الحفظ');
      return;
    }

    try {
      await SecureStore.setItemAsync(storageKey, value.trim());
      setSavedFlag(provider);
      setTimeout(() => setSavedFlag(null), 1800);
    } catch (err) {
      Alert.alert('خطأ', 'حصل خطأ أثناء حفظ المفتاح، حاول تاني');
    }
  }, [e2bKey, daytonaKey]);

  const handleSelectActive = useCallback(async (provider: Provider) => {
    setActiveProvider(provider);
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.activeProvider, provider);
    } catch (err) {
      console.warn('فشل حفظ المزوّد النشط', err);
    }
  }, []);

  const openSignupPage = useCallback((provider: Provider) => {
    Linking.openURL(PROVIDER_INFO[provider].signupUrl).catch(() => {
      Alert.alert('خطأ', 'مش قادر أفتح الرابط دلوقتي');
    });
  }, []);

  const handleSaveExpoToken = useCallback(async () => {
    if (!expoToken.trim()) {
      Alert.alert('تنبيه', 'من فضلك أدخل التوكن قبل الحفظ');
      return;
    }
    try {
      await SecureStore.setItemAsync('pocketforge_apikey_expo', expoToken.trim());
      setExpoTokenSaved(true);
      setTimeout(() => setExpoTokenSaved(false), 1800);
    } catch (err) {
      Alert.alert('خطأ', 'حصل خطأ أثناء حفظ التوكن، حاول تاني');
    }
  }, [expoToken]);

  const handleTestConnection = useCallback(async (provider: Provider) => {
    const storageKey =
      provider === 'e2b' ? STORAGE_KEYS.e2bKey : STORAGE_KEYS.daytonaKey;

    setTestingProvider(provider);
    setTestResult(null);

    try {
      const storedKey = await SecureStore.getItemAsync(storageKey);
      if (!storedKey) {
        setTestResult({
          provider,
          success: false,
          message: 'محتاج تحفظ المفتاح الأول قبل الاختبار',
        });
        return;
      }

      if (provider === 'daytona') {
        const result = await testDaytonaConnection(storedKey);
        setTestResult({ provider, success: result.success, message: result.message });
      } else {
        setTestResult({
          provider,
          success: false,
          message: 'اختبار الاتصال بـ E2B لسه مش متاح',
        });
      }
    } catch (err) {
      setTestResult({
        provider,
        success: false,
        message: 'حصل خطأ غير متوقع أثناء الاختبار',
      });
    } finally {
      setTestingProvider(null);
    }
  }, []);

  if (!loaded) {
    return <View style={styles.container} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>الإعدادات</Text>
      <Text style={styles.subtitle}>
        إدارة مفاتيح تشغيل المشاريع على السيرفر — اضغط على الكارت عشان تخليه
        المزوّد النشط
      </Text>

      {/* كارت E2B */}
      <ProviderCard
        provider="e2b"
        value={e2bKey}
        onChangeText={setE2bKey}
        show={showE2b}
        onToggleShow={() => setShowE2b((v) => !v)}
        onSave={() => handleSaveKey('e2b')}
        onOpenSignup={() => openSignupPage('e2b')}
        onSelect={() => handleSelectActive('e2b')}
        saved={savedFlag === 'e2b'}
        isActive={activeProvider === 'e2b'}
      />

      {/* كارت Daytona */}
      <ProviderCard
        provider="daytona"
        value={daytonaKey}
        onChangeText={setDaytonaKey}
        show={showDaytona}
        onToggleShow={() => setShowDaytona((v) => !v)}
        onSave={() => handleSaveKey('daytona')}
        onOpenSignup={() => openSignupPage('daytona')}
        onSelect={() => handleSelectActive('daytona')}
        onTest={() => handleTestConnection('daytona')}
        testing={testingProvider === 'daytona'}
        testResult={testResult?.provider === 'daytona' ? testResult : null}
        saved={savedFlag === 'daytona'}
        isActive={activeProvider === 'daytona'}
      />

      {/* كارت توكن Expo (اختياري) - بيخلي الـ tunnel موثّق بدل مجهول، وأكتر استقرارًا */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Expo Token (اختياري)</Text>
        </View>
        <Text style={styles.expoTokenHint}>
          بيحسّن استقرار الـ tunnel وقت التشغيل - مش إجباري
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={expoToken}
            onChangeText={setExpoToken}
            placeholder="توكن Personal Access من expo.dev"
            placeholderTextColor={colors.textFaint}
            secureTextEntry={!showExpoToken}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowExpoToken((v) => !v)} style={styles.eyeButton}>
            <Text style={styles.eyeButtonText}>{showExpoToken ? 'إخفاء' : 'إظهار'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSaveExpoToken} style={[styles.saveButton, { alignSelf: 'flex-end', marginTop: spacing.sm }]}>
          <Text style={styles.saveButtonText}>{expoTokenSaved ? 'تم الحفظ ✓' : 'حفظ'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footerNote}>
        المفاتيح بتتخزن مشفّرة على جهازك فقط، ومبتتبعتش لأي سيرفر تاني غير مزوّد
        التشغيل نفسه.
      </Text>
    </ScrollView>
  );
}

// ------- كارت المزوّد (Sub-component داخلي) -------

function ProviderCard({
  provider,
  value,
  onChangeText,
  show,
  onToggleShow,
  onSave,
  onOpenSignup,
  onSelect,
  onTest,
  testing,
  testResult,
  saved,
  isActive,
}: {
  provider: Provider;
  value: string;
  onChangeText: (t: string) => void;
  show: boolean;
  onToggleShow: () => void;
  onSave: () => void;
  onOpenSignup: () => void;
  onSelect: () => void;
  onTest?: () => void;
  testing?: boolean;
  testResult?: { success: boolean; message: string } | null;
  saved: boolean;
  isActive: boolean;
}) {
  const info = PROVIDER_INFO[provider];

  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{info.label}</Text>
        {isActive ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>نشط</Text>
          </View>
        ) : (
          <Text style={styles.tapToActivateText}>اضغط للتفعيل</Text>
        )}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={info.placeholder}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={onToggleShow} style={styles.eyeButton}>
          <Text style={styles.eyeButtonText}>{show ? 'إخفاء' : 'إظهار'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity onPress={onOpenSignup} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>احصل على مفتاح ↗</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>
            {saved ? 'تم الحفظ ✓' : 'حفظ'}
          </Text>
        </TouchableOpacity>
      </View>

      {onTest && (
        <>
          <TouchableOpacity
            onPress={onTest}
            style={styles.testButton}
            disabled={testing}
          >
            <Text style={styles.testButtonText}>
              {testing ? 'جاري الاختبار...' : 'اختبار الاتصال'}
            </Text>
          </TouchableOpacity>

          {testResult && (
            <Text
              style={[
                styles.testResultText,
                testResult.success
                  ? styles.testResultSuccess
                  : styles.testResultError,
              ]}
            >
              {testResult.message}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardActive: {
    borderColor: colors.accent,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.displaySemibold,
    fontSize: 17,
  },
  activeBadge: {
    backgroundColor: colors.accentGlow,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  activeBadgeText: {
    color: colors.accent,
    fontFamily: fonts.uiSemibold,
    fontSize: 11,
  },
  tapToActivateText: {
    color: colors.textFaint,
    fontFamily: fonts.ui,
    fontSize: 11,
  },
  expoTokenHint: {
    color: colors.textFaint,
    fontFamily: fonts.ui,
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.code,
    fontSize: 14,
    paddingVertical: spacing.sm,
  },
  eyeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  eyeButtonText: {
    color: colors.accent,
    fontFamily: fonts.uiMedium,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  linkButton: {
    paddingVertical: spacing.xs,
  },
  linkButtonText: {
    color: colors.textMuted,
    fontFamily: fonts.uiMedium,
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  saveButtonText: {
    color: colors.text,
    fontFamily: fonts.uiSemibold,
    fontSize: 14,
  },
  testButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  testButtonText: {
    color: colors.textMuted,
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  testResultText: {
    fontFamily: fonts.ui,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  testResultSuccess: {
    color: colors.success,
  },
  testResultError: {
    color: colors.error,
  },
  footerNote: {
    color: colors.textFaint,
    fontFamily: fonts.ui,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
