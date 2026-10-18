// src/components/terminal/useJsRunner.tsx
// مُشغّل جافاسكربت على الجهاز: WebView مخفي ومعزول بيتفتح لكل تشغيل ويتقفل بعده.
// الإيقاف (مهلة أو زر إيقاف) بيتم بإزالة الـ WebView نفسه، فيوقف حتى الحلقات اللانهائية.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { JsRunHandlers, JsRunInput, JsRunResult, JsRunner } from '../../terminal/types';
import { JS_RUNNER_HTML } from './jsRunnerHtml';

// JSON.stringify ما بيهربش U+2028/U+2029 وده ممكن يكسر السكربت المحقون
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const BACKSLASH = String.fromCharCode(92);
function toJs(value: unknown): string {
  return JSON.stringify(value)
    .split(LINE_SEP)
    .join(BACKSLASH + 'u2028')
    .split(PARA_SEP)
    .join(BACKSLASH + 'u2029');
}

interface Active {
  id: number;
  input: JsRunInput;
  handlers: JsRunHandlers;
  resolve: (r: JsRunResult) => void;
  timer: ReturnType<typeof setTimeout>;
  started: boolean;
}

const EMPTY: Omit<JsRunResult, 'status'> = { code: 0, writes: {}, removes: [], mkdirs: [] };

export function useJsRunner(): { runner: JsRunner; stop: () => void; element: React.ReactElement | null } {
  const [runId, setRunId] = useState(0);
  const [mounted, setMounted] = useState(false);
  const webRef = useRef<WebView>(null);
  const cur = useRef<Active | null>(null);
  const seq = useRef(0);

  const finish = useCallback((status: JsRunResult['status'], extra?: Partial<JsRunResult>) => {
    const a = cur.current;
    if (!a) return;
    cur.current = null;
    clearTimeout(a.timer);
    setMounted(false);
    a.resolve({ ...EMPTY, ...extra, status });
  }, []);

  const runner = useMemo<JsRunner>(
    () => ({
      run(input, handlers) {
        return new Promise<JsRunResult>((resolve) => {
          if (cur.current) {
            resolve({ ...EMPTY, status: 'crashed' });
            return;
          }
          const id = ++seq.current;
          const timer = setTimeout(() => finish('timeout'), input.timeoutMs);
          cur.current = { id, input, handlers, resolve, timer, started: false };
          setRunId(id);
          setMounted(true);
        });
      },
    }),
    [finish]
  );

  const stop = useCallback(() => finish('stopped'), [finish]);

  const onMessage = useCallback(
    (id: number, raw: string) => {
      const a = cur.current;
      if (!a || a.id !== id) return;
      let m: any;
      try {
        m = JSON.parse(raw);
      } catch {
        return;
      }
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'ready') {
        if (a.started) return;
        a.started = true;
        webRef.current?.injectJavaScript(`window.__start(${toJs(a.input)});true;`);
      } else if (m.t === 'out') a.handlers.out(String(m.s ?? ''));
      else if (m.t === 'err') a.handlers.err(String(m.s ?? ''));
      else if (m.t === 'diag') a.handlers.diag(String(m.code ?? ''), m.arg === undefined ? undefined : String(m.arg));
      else if (m.t === 'done') {
        finish('ok', {
          code: typeof m.code === 'number' ? m.code : 0,
          writes: m.writes && typeof m.writes === 'object' ? m.writes : {},
          removes: Array.isArray(m.removes) ? m.removes : [],
          mkdirs: Array.isArray(m.mkdirs) ? m.mkdirs : [],
        });
      }
    },
    [finish]
  );

  const element = mounted ? (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        key={runId}
        ref={webRef}
        source={{ html: JS_RUNNER_HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={(e) => onMessage(runId, e.nativeEvent.data)}
        onError={() => finish('crashed')}
        onHttpError={() => undefined}
        onRenderProcessGone={() => finish('crashed')}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        style={styles.web}
      />
    </View>
  ) : null;

  return { runner, stop, element };
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  web: { width: 1, height: 1, backgroundColor: 'transparent' },
});