// src/components/preview/PreviewPanel.tsx
// اللوحة الرئيسية لميزة المعاينة - بتجمع رفع الملفات + تشغيل نسخة الويب من
// المشروع + عرضها جوه إطار الموبايل (شكل بس، من غير تفاعل حقيقي) أو إطار
// المتصفح (شغال فعليًا وبالكامل، بتبديل كمبيوتر/موبايل) حسب اختيار المستخدم
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts, spacing, radius } from '../../theme/colors';
import { ProjectFile } from '../../screens/editor/useEditorFile';
import { loadSandboxId, saveSandboxId } from '../../utils/projectStorage';
import { createSandbox, uploadProjectFiles, runExpoWeb, RunProgressStage } from '../../utils/daytonaClient';
import MobileFrame from './MobileFrame';
import BrowserFrame from './BrowserFrame';
import PreviewToggle, { PreviewMode } from './PreviewToggle';

// كود بيمسك أي خطأ جافاسكريبت بيحصل جوه الصفحة (حتى لو حصل وهي لسه بتحمّل)
// ويبعتهولنا كرسالة، عشان نشوف السبب الحقيقي بدل ما نفضل نخمّن
const JS_ERROR_CAPTURE_JS = `
  window.onerror = function(message, source, lineno, colno, error) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'jsError',
      message: String(message),
      lineno: lineno,
      colno: colno,
      stack: error && error.stack ? String(error.stack) : null,
    }));
    return false;
  };
  window.addEventListener('unhandledrejection', function(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'unhandledRejection',
      reason: e.reason ? String(e.reason) : 'unknown',
    }));
  });
  true;
`;
// كود بيتحقن جوه صفحة الويب في وضع الموبايل بس - بيمنع أي تفاعل حقيقي (زراير،
// فورمات) بس بيسيب الروابط الحقيقية (<a>) تشتغل عادي لو المشروع فيه تنقل
// حقيقي بينها (زي Expo Router) - أي حاجة تانية بتتوقف
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
  // وضع عرض الموقع في وضع المتصفح - كمبيوتر (مصغّر ليتظبط) أو موبايل (طبيعي)
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
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

      // بنلاقي أي <script src="..."> جوه الصفحة، ونجيب محتواه إحنا بنفسنا،
      // ونحطه جوه الصفحة كـ <script> مضمّن - عشان لو سبناه للـ WebView يطلبه
      // هو هياخد نفس تحذير Daytona تاني (لأنه بيبان كمتصفح حقيقي برضو)
      let finalHtml = html;
      const scriptMatches = [...html.matchAll(/<script\s+src="([^"]+)"[^>]*>/g)];
      for (const match of scriptMatches) {
        const absoluteSrc = match[1].startsWith('http')
          ? match[1]
          : new URL(match[1], url).toString();
        try {
          const bundleResponse = await fetch(absoluteSrc);
          const bundleCode = await bundleResponse.text();
          finalHtml = finalHtml.replace(match[0], () => `<script>${bundleCode}</script>`);
        } catch (bundleErr) {
          // لو فشل جيب ملف معين، نسيبه زي ما هو - أحسن من ما نوقف كل حاجة
        }
      }
      setHtmlContent(finalHtml);
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

  // بنجهّز نسخة من الصفحة تتظبط حسب الوضع - في وضع الكمبيوتر بنستبدل إعداد
  // "viewport" الأصلي بواحد بيخلي الصفحة تتصرف وكأنها على شاشة عريضة 1200px،
  // والمتصفح نفسه بيصغّرها تلقائيًا عشان تتظبط - زي "طلب نسخة سطح المكتب" بالظبط
  const displayHtml = useMemo(() => {
    if (!htmlContent) return null;
    if (mode === 'browser' && viewport === 'desktop') {
      return htmlContent.replace(
        /<meta\s+name="viewport"[^>]*>/i,
        '<meta name="viewport" content="width=1200">'
      );
    }
    return htmlContent;
  }, [htmlContent, mode, viewport]);

  const renderContent = () => {
    if (status === 'ready' && webUrl && displayHtml) {
      return (
        <WebView
          key={`${mode}-${viewport}`}
          source={{ html: displayHtml, baseUrl: webUrl }}
          style={styles.webview}
          injectedJavaScriptBeforeContentLoaded={JS_ERROR_CAPTURE_JS}
          injectedJavaScript={mode === 'mobile' ? MOBILE_MODE_INJECTED_JS : undefined}
          onError={(e) => Alert.alert('خطأ WebView', JSON.stringify(e.nativeEvent))}
          onHttpError={(e) => Alert.alert('خطأ HTTP', JSON.stringify(e.nativeEvent))}
          onMessage={(e) => Alert.alert('خطأ جوه الصفحة', e.nativeEvent.data)}
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
          <BrowserFrame
            url={webUrl ?? undefined}
            viewport={viewport}
            onToggleViewport={() => setViewport((v) => (v === 'desktop' ? 'mobile' : 'desktop'))}
          >
            {renderContent()}
          </BrowserFrame>
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