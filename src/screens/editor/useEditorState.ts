// src/screens/editor/useEditorState.ts
import { useState, useRef, useCallback } from 'react';
import type WebView from 'react-native-webview';
import type { DiagnosticItem } from './EditorInfoModal';

interface UseEditorStateParams {
  initialContent: string;
  onDirtyChange?: (isDirty: boolean) => void;
}

export interface SearchResult {
  total: number;
  index: number;
}

export type DiagnosticsStatus = 'checking' | 'clean' | 'warning' | 'error';

export function useEditorState({ initialContent, onDirtyChange }: UseEditorStateParams) {
  const [content, setContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult>({ total: 0, index: 0 });
  const [isWrapped, setIsWrapped] = useState(false);
  const [errors, setErrors] = useState<DiagnosticItem[]>([]);
  const [warnings, setWarnings] = useState<DiagnosticItem[]>([]);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<DiagnosticsStatus>('checking');
  const webviewRef = useRef<WebView>(null);
  const savedContentRef = useRef(initialContent);

  const handleContentChanged = useCallback((newContent: string) => {
    setContent(newContent);
    const dirty = newContent !== savedContentRef.current;
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }, [onDirtyChange]);

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const postToEditor = useCallback((type: string, payload: any) => {
    webviewRef.current?.postMessage(JSON.stringify({ type, payload }));
  }, []);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'contentChanged') {
        handleContentChanged(msg.payload);
      } else if (msg.type === 'ready') {
        handleReady();
      } else if (msg.type === 'searchResult') {
        setSearchResult(msg.payload);
      } else if (msg.type === 'wrapState') {
        setIsWrapped(msg.payload);
      } else if (msg.type === 'diagnosticsChecking') {
        setDiagnosticsStatus('checking');
      } else if (msg.type === 'diagnostics') {
        const newErrors: DiagnosticItem[] = msg.payload.errors || [];
        const newWarnings: DiagnosticItem[] = msg.payload.warnings || [];
        setErrors(newErrors);
        setWarnings(newWarnings);
        if (newErrors.length > 0) setDiagnosticsStatus('error');
        else if (newWarnings.length > 0) setDiagnosticsStatus('warning');
        else setDiagnosticsStatus('clean');
      } else if (msg.type === 'error') {
        console.warn('[Editor WebView Error]', msg.payload);
      }
    } catch (e) {
      console.warn('[Editor] فشل تحليل رسالة الـ WebView', e);
    }
  }, [handleContentChanged, handleReady]);

  // تحميل ملف جديد جوا المحرر (فتح ملف - مش تعديل من المستخدم)
  // ملحوظة مهمة: هنا مبنستدعيش onDirtyChange خالص - فتح ملف مجرد عرض لمحتوى
  // محفوظ بالفعل، مش تعديل محتاج حفظ. استدعاء onDirtyChange هنا كان بيسبب
  // بق خطير: بيحفظ محتوى فاضي فوق المحتوى الحقيقي لحظة فتح أي ملف لأول مرة،
  // لأن setContent مش بيتطبّق فورًا (React بيأجله)، فالكود اللي بيسمع لـ
  // onDirtyChange كان بيقرا القيمة القديمة (الفاضية) بدل المحتوى اللي لسه بيتحمّل
  const loadFile = useCallback((newContent: string) => {
    savedContentRef.current = newContent;
    setContent(newContent);
    setIsDirty(false);
    postToEditor('setContent', newContent);
  }, [postToEditor]);

  const markSaved = useCallback(() => {
    savedContentRef.current = content;
    setIsDirty(false);
    onDirtyChange?.(false);
  }, [content, onDirtyChange]);

  const undo = useCallback(() => postToEditor('command', 'undo'), [postToEditor]);
  const redo = useCallback(() => postToEditor('command', 'redo'), [postToEditor]);
  const cut = useCallback(() => postToEditor('command', 'cut'), [postToEditor]);
  const copy = useCallback(() => postToEditor('command', 'copy'), [postToEditor]);
  const paste = useCallback(() => postToEditor('command', 'paste'), [postToEditor]);
  const selectAll = useCallback(() => postToEditor('command', 'selectAll'), [postToEditor]);

  const insertText = useCallback((text: string) => {
    postToEditor('insertText', text);
  }, [postToEditor]);

  const sendKeyboardCommand = useCallback((command: string) => {
    postToEditor('keyboardCommand', command);
  }, [postToEditor]);

  const setKeyboardLock = useCallback((useCustom: boolean) => {
    postToEditor('setKeyboardLock', useCustom);
  }, [postToEditor]);

  const search = useCallback((query: string, caseSensitive: boolean = false) => {
    postToEditor('search', { query, caseSensitive });
  }, [postToEditor]);

  const searchNext = useCallback(() => postToEditor('searchNext', null), [postToEditor]);
  const searchPrev = useCallback(() => postToEditor('searchPrev', null), [postToEditor]);

  const clearSearch = useCallback(() => {
    postToEditor('clearSearch', null);
    setSearchResult({ total: 0, index: 0 });
  }, [postToEditor]);

  const gotoLine = useCallback((lineNumber: number) => {
    postToEditor('gotoLine', lineNumber);
  }, [postToEditor]);

  const toggleWrap = useCallback(() => {
    postToEditor('toggleWrap', null);
  }, [postToEditor]);

  return {
    webviewRef,
    content,
    isDirty,
    isReady,
    searchResult,
    isWrapped,
    errors,
    warnings,
    diagnosticsStatus,
    handleWebViewMessage,
    loadFile,
    markSaved,
    undo,
    redo,
    cut,
    copy,
    paste,
    selectAll,
    insertText,
    sendKeyboardCommand,
    setKeyboardLock,
    search,
    searchNext,
    searchPrev,
    clearSearch,
    gotoLine,
    toggleWrap,
  };
}
