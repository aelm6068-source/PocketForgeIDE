// src/screens/editor/EditorWebView.tsx
import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { getEditorHtml } from './editorHtml';
import { colors } from '../../theme/colors';

export type EditorLanguage = 'ts' | 'tsx' | 'js' | 'jsx';

interface EditorWebViewProps {
  webviewRef: React.RefObject<WebView | null>;
  initialContent: string;
  language: EditorLanguage;
  isReady: boolean;
  onMessage: (event: any) => void;
}

export default function EditorWebView({
  webviewRef,
  initialContent,
  language,
  isReady,
  onMessage,
}: EditorWebViewProps) {
  const handleLoadEnd = useCallback(() => {
    webviewRef.current?.postMessage(
      JSON.stringify({
        type: 'init',
        payload: { content: initialContent, language },
      })
    );
  }, [webviewRef, initialContent, language]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: getEditorHtml() }}
        onMessage={onMessage}
        onLoadEnd={handleLoadEnd}
        javaScriptEnabled
        domStorageEnabled
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        scrollEnabled
        nestedScrollEnabled
        overScrollMode="always"
        bounces={false}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
});