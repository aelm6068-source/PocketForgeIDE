// src/utils/fileNames.ts
// قواعد أسماء الملفات والمجلدات: صلاحية الاسم، ومنع التكرار جوه نفس المجلد
import type { ProjectFile } from '../screens/editor/useEditorFile';

const MAX_NAME_LENGTH = 100;

export type NameCheck = 'ok' | 'invalid' | 'exists';

// اسم صالح: مش فاضي، مفيهوش / أو \، مش . أو ..، ومش أطول من 100 حرف
export function isValidFileName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_NAME_LENGTH) return false;
  if (trimmed === '.' || trimmed === '..') return false;
  if (/[\\/]/.test(trimmed)) return false;
  return true;
}

// فيه عنصر تاني بنفس الاسم جوه نفس المجلد؟ (excludeId بيستثني العنصر نفسه وقت
// إعادة التسمية). المقارنة بتتجاهل حالة الحروف
export function hasSiblingWithName(
  files: ProjectFile[],
  parentId: string | null,
  name: string,
  excludeId?: string
): boolean {
  const target = name.trim().toLowerCase();
  return files.some(
    (f) => f.parentId === parentId && f.id !== excludeId && f.name.toLowerCase() === target
  );
}

// يفحص اسم جديد ويرجّع: ok / invalid / exists
export function checkNewName(
  files: ProjectFile[],
  parentId: string | null,
  name: string,
  excludeId?: string
): NameCheck {
  if (!isValidFileName(name)) return 'invalid';
  if (hasSiblingWithName(files, parentId, name, excludeId)) return 'exists';
  return 'ok';
}

// يرجّع اسم فريد: لو الاسم موجود بيضيف -2 أو -3... قبل الامتداد (زي photo-2.png)
export function makeUniqueName(
  files: ProjectFile[],
  parentId: string | null,
  name: string
): string {
  const trimmed = name.trim();
  if (!hasSiblingWithName(files, parentId, trimmed)) return trimmed;

  const dot = trimmed.lastIndexOf('.');
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const ext = dot > 0 ? trimmed.slice(dot) : '';

  let counter = 2;
  let candidate = `${base}-${counter}${ext}`;
  while (hasSiblingWithName(files, parentId, candidate)) {
    counter += 1;
    candidate = `${base}-${counter}${ext}`;
  }
  return candidate;
}