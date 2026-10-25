// src/github/useZipImport.ts
// hook استيراد مشروع من ZIP: بيفتح منتقي الملفات، يقرا الملف، يفكه، وينشئ مشروع جديد.
// المشروع مبيتربطش بـ GitHub: لو عايز ترفعه بعدين، لوحة المزامنة بتنشئ له مستودع.
import { useCallback, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { deleteProjectData, saveFileContent, saveProjectFiles, deleteFileContent } from '../utils/projectStorage';
import { importZip, looksLikeZip, ZipImportError } from './zipImport';
import type { ZipImportErrorCode, ZipProgress } from './zipImport';
import type { ImportedProject } from './useGithubImport';
import type { PullSkip } from './pullPlan';

export type ZipErrorUi = ZipImportErrorCode | 'read';

export type ZipUi =
  | { kind: 'idle' }
  // منتقي الملفات مفتوح (النافذة لسه مخفية)
  | { kind: 'picking' }
  | { kind: 'reading'; file: string }
  | { kind: 'working'; file: string; progress: ZipProgress | null }
  | { kind: 'done'; project: ImportedProject; fileCount: number; skipped: PullSkip[] }
  | { kind: 'error'; code: ZipErrorUi };

export const MAX_ZIP_BYTES = 100 * 1024 * 1024;

export function useZipImport(onImported: (project: ImportedProject) => void, fallbackName: string) {
  const [ui, setUi] = useState<ZipUi>({ kind: 'idle' });
  const busy = useRef(false);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setUi({ kind: 'picking' });
    const projectId = Date.now().toString();
    try {
      let picked: DocumentPicker.DocumentPickerResult;
      try {
        picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      } catch {
        setUi({ kind: 'error', code: 'read' });
        return;
      }
      if (picked.canceled || picked.assets.length === 0) {
        setUi({ kind: 'idle' });
        return;
      }
      const asset = picked.assets[0];
      if (typeof asset.size === 'number' && asset.size > MAX_ZIP_BYTES) {
        setUi({ kind: 'error', code: 'too_big' });
        return;
      }

      setUi({ kind: 'reading', file: asset.name });
      let bytes: Uint8Array;
      try {
        const response = await fetch(asset.uri);
        bytes = new Uint8Array(await response.arrayBuffer());
      } catch {
        setUi({ kind: 'error', code: 'read' });
        return;
      }
      if (bytes.length > MAX_ZIP_BYTES) {
        setUi({ kind: 'error', code: 'too_big' });
        return;
      }
      if (!looksLikeZip(bytes)) {
        setUi({ kind: 'error', code: 'bad_zip' });
        return;
      }

      setUi({ kind: 'working', file: asset.name, progress: null });
      try {
        const result = await importZip(
          bytes,
          asset.name,
          fallbackName,
          {
            writeContent: (fileId, content) => saveFileContent(projectId, fileId, content),
            deleteContent: (fileId) => deleteFileContent(projectId, fileId),
          },
          (progress) => setUi({ kind: 'working', file: asset.name, progress })
        );
        await saveProjectFiles(projectId, result.nodes);
        const project: ImportedProject = { id: projectId, name: result.name, language: result.language };
        onImported(project);
        setUi({ kind: 'done', project, fileCount: result.fileCount, skipped: result.skipped });
      } catch (err) {
        // فشل في النص: نمسح أي حاجة اتكتبت عشان ميفضلش مشروع نصف مستورد
        await deleteProjectData(projectId);
        setUi({ kind: 'error', code: err instanceof ZipImportError ? err.code : 'unknown' });
      }
    } finally {
      busy.current = false;
    }
  }, [onImported, fallbackName]);

  const close = useCallback(() => {
    if (!busy.current) setUi({ kind: 'idle' });
  }, []);

  return { ui, start, close };
}