// src/utils/projectStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProjectFile } from '../screens/editor/useEditorFile';

const filesKey = (projectId: string) => `pocketforge:files:${projectId}`;
const contentKey = (projectId: string, fileId: string) => `pocketforge:content:${projectId}:${fileId}`;
const sandboxKey = (projectId: string) => `pocketforge_sandbox_${projectId}`;
const PROJECTS_LIST_KEY = 'pocketforge_projects_list';

// حفظ/قراءة قائمة المشاريع نفسها (الأسماء، اللغة، آخر تعديل) - منفصلة عن ملفات كل مشروع
// من غير الحفظ ده، القائمة كانت بس في الذاكرة وبتتصفر كل مرة التطبيق يعمل reload
export async function saveProjectsList(projects: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(projects));
  } catch (e) {
    console.warn('[projectStorage] فشل حفظ قائمة المشاريع', e);
  }
}

export async function loadProjectsList(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(PROJECTS_LIST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[projectStorage] فشل تحميل قائمة المشاريع', e);
    return null;
  }
}

// حفظ/قراءة قائمة الملفات الخاصة بمشروع معين (الأسماء والأنواع، مش المحتوى)
export async function saveProjectFiles(projectId: string, files: ProjectFile[]): Promise<void> {
  try {
    await AsyncStorage.setItem(filesKey(projectId), JSON.stringify(files));
  } catch (e) {
    console.warn('[projectStorage] فشل حفظ قائمة الملفات', e);
  }
}

export async function loadProjectFiles(projectId: string): Promise<ProjectFile[] | null> {
  try {
    const raw = await AsyncStorage.getItem(filesKey(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[projectStorage] فشل تحميل قائمة الملفات', e);
    return null;
  }
}

// حفظ/قراءة محتوى ملف واحد بعينه
export async function saveFileContent(projectId: string, fileId: string, content: string): Promise<void> {
  try {
    await AsyncStorage.setItem(contentKey(projectId, fileId), content);
  } catch (e) {
    console.warn('[projectStorage] فشل حفظ محتوى الملف', e);
  }
}

export async function loadFileContent(projectId: string, fileId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(contentKey(projectId, fileId));
  } catch (e) {
    console.warn('[projectStorage] فشل تحميل محتوى الملف', e);
    return null;
  }
}

// حذف محتوى ملف (مفيد لو المستخدم مسح الملف من شاشة الملفات)
export async function deleteFileContent(projectId: string, fileId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(contentKey(projectId, fileId));
  } catch (e) {
    console.warn('[projectStorage] فشل حذف محتوى الملف', e);
  }
}

// حفظ/قراءة الـ sandboxId المرتبط بمشروع معين، عشان نعيد استخدام نفس الـ Sandbox
// بدل ما ننشئ واحد جديد في كل مرة (وده اللي كان بيستهلك مساحة Daytona بسرعة)
export async function saveSandboxId(projectId: string, sandboxId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(sandboxKey(projectId), sandboxId);
  } catch (e) {
    console.warn('[projectStorage] فشل حفظ sandboxId', e);
  }
}

export async function loadSandboxId(projectId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(sandboxKey(projectId));
  } catch (e) {
    console.warn('[projectStorage] فشل تحميل sandboxId', e);
    return null;
  }
}

export async function clearSandboxId(projectId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(sandboxKey(projectId));
  } catch (e) {
    console.warn('[projectStorage] فشل حذف sandboxId', e);
  }
}
