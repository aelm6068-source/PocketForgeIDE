// src/screens/editor/useEditorFile.ts
import { useState, useCallback, useMemo } from 'react';

export interface ProjectFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
}

export interface OpenFile {
  id: string;
  name: string;
  content: string;
  isDirty: boolean;
}

// محتوى افتراضي بسيط حسب نوع الملف، لحد ما نربط نظام ملفات حقيقي
function getDefaultContent(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'tsx' || ext === 'jsx') {
    return `export default function Component() {\n  return null;\n}\n`;
  }
  if (ext === 'json') return `{\n\n}\n`;
  if (ext === 'md') return `# ${fileName}\n`;
  return '';
}

// بيحدد هل الملف React (tsx/jsx) عشان نفعّل الـ highlighting الصح جوه CodeMirror
export function isTsxFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ext === 'tsx' || ext === 'jsx';
}

export type EditorLanguage = 'ts' | 'tsx' | 'js' | 'jsx';

// بيحدد لغة الملف الفعلية من امتداده، عشان الفحص يتم بقواعد اللغة الصح
export function getFileLanguage(fileName: string): EditorLanguage {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    return ext as EditorLanguage;
  }
  return 'tsx'; // افتراضي لو الامتداد مش معروف
}

export function useEditorFile(projectFiles: ProjectFile[]) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // بنبني فهرس سريع لملفات المشروع عشان أي تحقق (validation) يبقى فوري
  const projectFilesById = useMemo(() => {
    const map = new Map<string, ProjectFile>();
    projectFiles.forEach((f) => map.set(f.id, f));
    return map;
  }, [projectFiles]);

  // فتح ملف: بيتحقق الأول إنه موجود فعلاً في المشروع ونوعه "file" مش "folder"
  // ولو مفتوح already، بس بيفعّله كـ active من غير ما يكرره
  const openFile = useCallback((fileId: string) => {
    const target = projectFilesById.get(fileId);

    if (!target || target.type !== 'file') {
      console.warn('[useEditorFile] محاولة فتح ملف غير موجود أو مش ملف فعلي:', fileId);
      return;
    }

    setOpenFiles((prev) => {
      const alreadyOpen = prev.some((f) => f.id === fileId);
      if (alreadyOpen) return prev;
      return [
        ...prev,
        {
          id: target.id,
          name: target.name,
          content: getDefaultContent(target.name),
          isDirty: false,
        },
      ];
    });

    setActiveFileId(fileId);
  }, [projectFilesById]);

  // قفل ملف: لو كان هو الملف النشط، بننقل الـ focus لأقرب ملف متاح تلقائياً
  // عشان المحرر ميفضلش من غير ملف نشط (حالة وهمية)
  const closeFile = useCallback((fileId: string) => {
    setOpenFiles((prev) => {
      const index = prev.findIndex((f) => f.id === fileId);
      if (index === -1) return prev;

      const next = prev.filter((f) => f.id !== fileId);

      setActiveFileId((currentActive) => {
        if (currentActive !== fileId) return currentActive;
        if (next.length === 0) return null;
        const fallbackIndex = Math.max(0, index - 1);
        return next[fallbackIndex]?.id ?? next[0].id;
      });

      return next;
    });
  }, []);

  const setActiveFile = useCallback((fileId: string) => {
    const exists = openFiles.some((f) => f.id === fileId);
    if (!exists) {
      console.warn('[useEditorFile] محاولة تفعيل ملف مش مفتوح:', fileId);
      return;
    }
    setActiveFileId(fileId);
  }, [openFiles]);

  // تحديث محتوى ملف مفتوح (بيتنادى من useEditorState عند كل تغيير في CodeMirror)
  const updateFileContent = useCallback((fileId: string, content: string, isDirty: boolean) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content, isDirty } : f))
    );
  }, []);

  const activeFile = useMemo(
    () => openFiles.find((f) => f.id === activeFileId) ?? null,
    [openFiles, activeFileId]
  );

  return {
    openFiles,
    activeFile,
    activeFileId,
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
  };
}