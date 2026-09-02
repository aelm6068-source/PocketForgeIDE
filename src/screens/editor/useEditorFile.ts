// src/screens/editor/useEditorFile.ts
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  saveProjectFiles,
  loadProjectFiles,
  saveFileContent,
  loadFileContent,
  deleteFileContent,
} from '../../utils/projectStorage';

export interface ProjectFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  // المجلد الأب - null يعني الملف/المجلد في جذر المشروع
  parentId: string | null;
}

export interface OpenFile {
  id: string;
  name: string;
  content: string;
  isDirty: boolean;
}

function getDefaultContent(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'tsx' || ext === 'jsx') {
    return `export default function Component() {\n  return null;\n}\n`;
  }
  if (ext === 'json') return `{\n\n}\n`;
  if (ext === 'md') return `# ${fileName}\n`;
  return '';
}

export type EditorLanguage = 'ts' | 'tsx' | 'js' | 'jsx';

export function getFileLanguage(fileName: string): EditorLanguage {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    return ext as EditorLanguage;
  }
  return 'tsx';
}

export function isTsxFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ext === 'tsx' || ext === 'jsx';
}

// يبني المسار الكامل لملف/مجلد بالمشي على سلسلة الآباء لحد الجذر
// مثال: App.tsx جوا src -> "src/App.tsx"
export function buildFilePath(fileId: string, allFiles: ProjectFile[]): string {
  const byId = new Map(allFiles.map((f) => [f.id, f]));
  const parts: string[] = [];
  let current = byId.get(fileId);
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) break; // حماية من حلقة لا نهائية لو حصل خطأ بيانات
    visited.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return parts.join('/');
}

// كل الملفات/المجلدات اللي جوا مجلد معين مباشرة (مستوى واحد فقط)
export function getChildren(parentId: string | null, allFiles: ProjectFile[]): ProjectFile[] {
  return allFiles.filter((f) => f.parentId === parentId);
}

// كل الأحفاد (ملفات ومجلدات) بتاعة مجلد معين، على كل المستويات - مفيد وقت الحذف/التكرار
export function getDescendantIds(folderId: string, allFiles: ProjectFile[]): string[] {
  const result: string[] = [];
  const queue = [folderId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allFiles.filter((f) => f.parentId === currentId);
    for (const child of children) {
      result.push(child.id);
      if (child.type === 'folder') queue.push(child.id);
    }
  }
  return result;
}

export function useEditorFile(projectId: string, initialProjectFiles: ProjectFile[]) {
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>(initialProjectFiles);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedFiles = useRef(false);

  // أول ما الشاشة تفتح: نحاول نحمّل قائمة الملفات المحفوظة فعليًا، ولو مفيش، نستخدم القايمة الوهمية الافتراضية
  useEffect(() => {
    if (hasLoadedFiles.current) return;
    hasLoadedFiles.current = true;

    loadProjectFiles(projectId).then((saved) => {
      if (saved && saved.length > 0) {
        setProjectFiles(saved);
      } else {
        saveProjectFiles(projectId, initialProjectFiles);
      }
      setIsLoaded(true);
    });
  }, [projectId]);

  const projectFilesById = useMemo(() => {
    const map = new Map<string, ProjectFile>();
    projectFiles.forEach((f) => map.set(f.id, f));
    return map;
  }, [projectFiles]);

  const openFile = useCallback(async (fileId: string) => {
    const target = projectFilesById.get(fileId);
    if (!target || target.type !== 'file') {
      console.warn('[useEditorFile] محاولة فتح ملف غير موجود أو مش ملف فعلي:', fileId);
      return;
    }

    const alreadyOpen = openFiles.some((f) => f.id === fileId);
    if (!alreadyOpen) {
      // نحاول نجيب المحتوى المحفوظ فعليًا، ولو مفيش نستخدم محتوى افتراضي حسب نوع الملف
      const savedContent = await loadFileContent(projectId, fileId);
      const content = savedContent !== null ? savedContent : getDefaultContent(target.name);

      setOpenFiles((prev) => {
        if (prev.some((f) => f.id === fileId)) return prev;
        return [...prev, { id: target.id, name: target.name, content, isDirty: false }];
      });
    }

    setActiveFileId(fileId);
  }, [projectFilesById, openFiles, projectId]);

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

  // تحديث محتوى ملف مفتوح، وحفظه فعليًا لو مش dirty (يعني اتحفظ) — التخزين الفعلي بيحصل هنا
  const updateFileContent = useCallback((fileId: string, content: string, isDirty: boolean) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content, isDirty } : f))
    );
    if (!isDirty) {
      saveFileContent(projectId, fileId, content);
    }
  }, [projectId]);

  // إضافة ملف/مجلد جديد جوا مجلد معين (أو الجذر لو parentId = null)
  const addProjectFile = useCallback((name: string, type: 'file' | 'folder', parentId: string | null = null) => {
    const newFile: ProjectFile = { id: Date.now().toString(), name, type, parentId };
    setProjectFiles((prev) => {
      const next = [...prev, newFile];
      saveProjectFiles(projectId, next);
      return next;
    });
    return newFile;
  }, [projectId]);

  // إعادة تسمية ملف أو مجلد
  const renameProjectFile = useCallback((fileId: string, newName: string) => {
    setProjectFiles((prev) => {
      const next = prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f));
      saveProjectFiles(projectId, next);
      return next;
    });
    setOpenFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f)));
  }, [projectId]);

  // تكرار ملف (نسخة جديدة بنفس المحتوى جنبه في نفس المجلد)
  const duplicateProjectFile = useCallback(async (fileId: string) => {
    const target = projectFilesById.get(fileId);
    if (!target || target.type !== 'file') return null;

    const dotIndex = target.name.lastIndexOf('.');
    const baseName = dotIndex > 0 ? target.name.slice(0, dotIndex) : target.name;
    const ext = dotIndex > 0 ? target.name.slice(dotIndex) : '';
    const copyName = `${baseName}-copy${ext}`;

    const content = await loadFileContent(projectId, fileId);
    const newFile: ProjectFile = {
      id: Date.now().toString(),
      name: copyName,
      type: 'file',
      parentId: target.parentId,
    };

    setProjectFiles((prev) => {
      const next = [...prev, newFile];
      saveProjectFiles(projectId, next);
      return next;
    });

    if (content !== null) {
      await saveFileContent(projectId, newFile.id, content);
    }

    return newFile;
  }, [projectId, projectFilesById]);

  // حذف ملف أو مجلد (ولو مجلد، بيحذف كل اللي جواه على كل المستويات)
  const deleteProjectFile = useCallback((fileId: string) => {
    setProjectFiles((prev) => {
      const target = prev.find((f) => f.id === fileId);
      if (!target) return prev;

      const idsToDelete = target.type === 'folder'
        ? [fileId, ...getDescendantIds(fileId, prev)]
        : [fileId];

      const next = prev.filter((f) => !idsToDelete.includes(f.id));
      saveProjectFiles(projectId, next);

      idsToDelete.forEach((id) => {
        deleteFileContent(projectId, id);
        closeFile(id);
      });

      return next;
    });
  }, [projectId, closeFile]);

  const activeFile = useMemo(
    () => openFiles.find((f) => f.id === activeFileId) ?? null,
    [openFiles, activeFileId]
  );

  return {
    projectFiles,
    isLoaded,
    openFiles,
    activeFile,
    activeFileId,
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
    addProjectFile,
    renameProjectFile,
    duplicateProjectFile,
    deleteProjectFile,
  };
}
