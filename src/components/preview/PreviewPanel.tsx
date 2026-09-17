// src/components/preview/PreviewPanel.tsx
// اللوحة الرئيسية لميزة المعاينة - بتجمع رفع الملفات + تشغيل نسخة الويب من
// المشروع + عرضها جوه إطار الموبايل (شكل بس، من غير تفاعل حقيقي) أو إطار
// المتصفح (شغال فعليًا وبالكامل) حسب اختيار المستخدم من PreviewToggle
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { ProjectFile } from '../../screens/editor/useEditorFile';
import { loadSandboxId, saveSandboxId } from '../../utils/projectStorage';
import { createSandbox, uploadProjectFiles, runExpoWeb, RunProgressStage } from '../../utils/daytonaClient';
import MobileFrame from './MobileFrame';
import BrowserFrame from './BrowserFrame';
import PreviewToggle, { PreviewMode } from './PreviewToggle';

// كود بيتحقن جوه صفحة الويب في وضع الموبايل بس - بيمنع أي تفاعل حقيقي (زراير،
// فورمات) بس بيسيب الروابط الحقيقية (<a>) تشتغل عادي لو المشروع فيه تنقل
// حقيقي بينها (زي Expo Router) - أي حاجة تانية بتتوقف
// كود بيدوس تلقائيًا على تحذير الأمان بتاع Daytona ("I Understand, Continue")
// اللي بيظهر أول مرة لأي متصفح حقيقي بيفتح رابط المعاينة - عشان المستخدم مايشوفوش خالص
const DAYTONA_WARNING_BYPASS_JS = `
  (function() {
    function tryBypass() {
      var els = document.querySelectorAll('a, button');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].innerText || '').toLowerCase();
        if (t.indexOf('continue') !== -1 || t.indexOf('i understand') !== -1) {
          els[i].click();
          return true;
        }
      }
      return false;
    }
    if (!tryBypass()) {
      var n = 0;
      var iv = setInterval(function() {
        n++;
        if (tryBypass() || n > 10) clearInterval(iv);
      }, 300);
    }
  })();
  true;
`;
const MOBILE_MODE_INJECTED_JS = `
  document.addEventListener('click', function(e) {
    var link = e.target.closest && e.target.closest('a');
    if (!link) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  true;
`;

type PreviewPanelProps = {
  projectId: string;
  files: ProjectFile[];
};

export default function PreviewPanel({ projectId, files }: PreviewPanelProps) {
  const [mode, setMode] = useState<PreviewMode>('mobile');
  const [status, setStatus] = useState<RunProgressStage | 'idle'>('idle');
  const [message, setMessage] = useState('');
  const [webUrl, setWebUrl] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const hasStarted = useRef(false);

  const startPreview = useCallback(async () => {
    const apiKey = await SecureStore.getItemAsync('pocketforge_apikey_daytona');
    if (!apiKey) {
      setStatus('failed');
      setMessage('محتاج تحفظ مفتاح Daytona في الإعدادات الأول');
      return;
    }

    setStatus('installing');
    setMessage('جاري التجهيز...');

    try {
      let sandboxId = await loadSandboxId(projectId);
      if (!sandboxId) {
        setMessage('جاري إنشاء بيئة تشغيل...');
        sandboxId = await createSandbox(apiKey);
        await saveSandboxId(projectId, sandboxId);
      }

      setMessage('جاري رفع ملفات المشروع...');
      await uploadProjectFiles(apiKey, sandboxId, projectId, files);

      const url = await runExpoWeb(apiKey, sandboxId, (progress) => {
        setStatus(progress.stage);
        setMessage(progress.message);
      });

      setWebUrl(url);

      // بنجيب محتوى الصفحة إحنا بنفسنا (مش الـ WebView) عشان نتجاوز مشكلة
      // تحذير Daytona اللي بيظهر بس للمتصفحات الحقيقية - طلب عادي زي ده بيوصل
      // للمحتوى الحقيقي على طول من غير أي تحذير
      const htmlResponse = await fetch(url);
      const html = await htmlResponse.text();
      setHtmlContent(html);
    } catch (err: any) {
      setStatus('failed');
      setMessage(err?.message ?? 'حصلت مشكلة غير متوقعة أثناء تجهيز المعاينة');
    }
  }, [projectId, files]);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startPreview();
  }, [startPreview]);

  const renderContent = () => {
    if (status === 'ready' && webUrl && htmlContent) {
      return (
        <WebView
          source={{ html: htmlContent, baseUrl: webUrl }}
          style={styles.webview}
          injectedJavaScript={mode === 'mobile' ? MOBILE_MODE_INJECTED_JS : undefined}
        />
      );
     }

    if (status === 'failed') {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{message}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={startPreview}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>{message || 'جاري التجهيز...'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <PreviewToggle mode={mode} onChange={setMode} />

      {mode === 'mobile' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ دي معاينة شكل تقريبية بس - التشغيل الحقيقي الكامل في تطبيق Expo Go، والمعاينة هنا حاليًا بتعرض App.tsx فقط من غير تفاعل حقيقي
          </Text>
        </View>
      )}

      <View style={styles.frameArea}>
        {mode === 'mobile' ? (
          <MobileFrame>{renderContent()}</MobileFrame>
        ) : (
          <BrowserFrame url={webUrl ?? undefined}>{renderContent()}</BrowserFrame>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.md,
  },
  warningBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    borderRadius: radius.md,
  },
  warningText: {
    color: '#F87171',
    fontSize: 11,
    fontFamily: fonts.ui,
    textAlign: 'center',
    lineHeight: 16,
  },
  frameArea: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.ui,
    textAlign: 'center',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontFamily: fonts.ui,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.uiSemibold,
  },
});