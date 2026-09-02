// src/screens/editor/EditorScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../../theme/colors';
import EditorToolbar from './EditorToolbar';
import EditorActionBar from './EditorActionBar';
import EditorSearchBar from './EditorSearchBar';
import EditorWebView from './EditorWebView';
import CodingKeyboard, { type KeyboardMode } from './CodingKeyboard';
import EditorInfoModal, { type InfoModalKind } from './EditorInfoModal';
import { useEditorState } from './useEditorState';
import { useEditorFile, getFileLanguage, type ProjectFile } from './useEditorFile';

function getLanguageLabel(fileName: string): 'TypeScript' | 'JavaScript' | 'JSON' | 'Markdown' | 'Plain Text' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'ts' || ext === 'tsx') return 'TypeScript';
  if (ext === 'js' || ext === 'jsx') return 'JavaScript';
  if (ext === 'json') return 'JSON';
  if (ext === 'md') return 'Markdown';
  return 'Plain Text';
}

const AUTOSAVE_DELAY = 700;

export default function EditorScreen({ route, navigation }: any) {
  const { projectId, projectName, files, initialFileId } = route.params as {
    projectId: string;
    projectName: string;
    files: ProjectFile[];
    initialFileId: string;
  };

  const editorFile = useEditorFile(projectId, files);
  const hasOpenedInitial = useRef(false);
  const [keyboardMode, setKeyboardMode] = useState<KeyboardMode>('custom');
  const [keyboardCollapsed, setKeyboardCollapsed] = useState(false);
  const [modalKind, setModalKind] = useState<InfoModalKind>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasOpenedInitial.current && initialFileId) {
      editorFile.openFile(initialFileId);
      hasOpenedInitial.current = true;
    }
  }, [initialFileId, editorFile]);

  const activeFile = editorFile.activeFile;

  const editorState = useEditorState({
    initialContent: activeFile?.content ?? '',
    onDirtyChange: (isDirty) => {
      if (!activeFile) return;
      editorFile.updateFileContent(activeFile.id, editorState.content, isDirty);

      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (isDirty) {
        autosaveTimer.current = setTimeout(() => {
          editorState.markSaved();
          editorFile.updateFileContent(activeFile.id, editorState.content, false);
        }, AUTOSAVE_DELAY);
      }
    },
  });

  useEffect(() => {
    if (editorState.isReady) {
      editorState.setKeyboardLock(keyboardMode === 'custom');
    }
  }, [keyboardMode, editorState.isReady]);

  const prevActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeFile && prevActiveIdRef.current !== activeFile.id) {
      editorState.loadFile(activeFile.content);
      prevActiveIdRef.current = activeFile.id;
      setSearchVisible(false);
      editorState.clearSearch();
    }
  }, [activeFile, editorState]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleToggleSearch = () => {
    setSearchVisible((v) => {
      const next = !v;
      if (!next) editorState.clearSearch();
      return next;
    });
  };

  const dirtyFiles = editorFile.openFiles
    .filter((f) => f.isDirty)
    .map((f) => ({ id: f.id, name: f.name }));

  if (!activeFile) {
    return <View style={styles.container} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <EditorToolbar
        openFiles={editorFile.openFiles}
        activeFileId={editorFile.activeFileId}
        onSelectFile={editorFile.setActiveFile}
        onCloseFile={(fileId) => {
          editorFile.closeFile(fileId);
          if (editorFile.openFiles.length <= 1) {
            navigation.goBack();
          }
        }}
        onBack={handleBack}
        onUndo={editorState.undo}
        onRedo={editorState.redo}
        onToggleSearch={handleToggleSearch}
        isSearchActive={searchVisible}
        onToggleWrap={editorState.toggleWrap}
        isWrapped={editorState.isWrapped}
      />

      <EditorSearchBar
        visible={searchVisible}
        searchResult={editorState.searchResult}
        onSearch={editorState.search}
        onNext={editorState.searchNext}
        onPrev={editorState.searchPrev}
        onGotoLine={editorState.gotoLine}
        onClose={handleToggleSearch}
      />

      <EditorActionBar
        fileName={activeFile.name}
        language={getLanguageLabel(activeFile.name)}
        status={editorState.diagnosticsStatus}
        errorCount={editorState.errors.length}
        warningCount={editorState.warnings.length}
        dirtyFilesCount={dirtyFiles.length}
        onOpenModal={setModalKind}
      />

      <EditorWebView
        webviewRef={editorState.webviewRef}
        initialContent={activeFile.content}
        language={getFileLanguage(activeFile.name)}
        isReady={editorState.isReady}
        onMessage={editorState.handleWebViewMessage}
      />

      <CodingKeyboard
        mode={keyboardMode}
        collapsed={keyboardCollapsed}
        onToggleMode={() => setKeyboardMode((m) => (m === 'custom' ? 'native' : 'custom'))}
        onToggleCollapsed={() => setKeyboardCollapsed((c) => !c)}
        onInsertText={editorState.insertText}
        onCommand={editorState.sendKeyboardCommand}
      />

      <EditorInfoModal
        kind={modalKind}
        errors={editorState.errors}
        warnings={editorState.warnings}
        dirtyFiles={dirtyFiles}
        onClose={() => setModalKind(null)}
        onSelectDirtyFile={(fileId) => editorFile.setActiveFile(fileId)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
