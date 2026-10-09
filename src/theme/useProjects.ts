// src/theme/useProjects.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Project } from './types';
import {
  saveProjectsList,
  loadProjectsList,
  loadSandboxId,
  deleteProjectData,
} from '../utils/projectStorage';
import { deleteSandbox } from '../utils/daytonaClient';

// تبدأ فاضية - أول مشروع بيضيفه المستخدم بنفسه من زرار (+)
const initialProjects: Project[] = [];

// بيقرا القائمة المحفوظة، وأي مشروع قديم كان وقت آخر تعديل بتاعه نص ثابت
// (زي 'الآن') بيتحوّل لتاريخ حقيقي ويتحفظ تاني
async function readProjects(): Promise<Project[]> {
  const saved = await loadProjectsList();
  if (!saved || !Array.isArray(saved)) return [];

  let migrated = false;
  const normalized: Project[] = saved.map((p: Project) => {
    if (Number.isNaN(Date.parse(p.lastModified))) {
      migrated = true;
      return { ...p, lastModified: new Date().toISOString() };
    }
    return p;
  });

  if (migrated) saveProjectsList(normalized);
  return normalized;
}

// تنظيف بيانات مشروع محذوف: سيرفر Daytona الأول (لازم نقرا الـ sandboxId قبل
// ما نمسحه من الجهاز)، وبعدين كل بياناته المحلية
async function cleanupProjectData(projectId: string): Promise<void> {
  try {
    const apiKey = await SecureStore.getItemAsync('pocketforge_apikey_daytona');
    const sandboxId = await loadSandboxId(projectId);
    if (apiKey && sandboxId) {
      await deleteSandbox(apiKey, sandboxId);
    }
  } catch (e) {
    // لو فشل مسح السيرفر (مفيش إنترنت مثلًا) بنكمل، وزرار "مسح وتنظيف السيرفر"
    // هيلقطه بعدين كسيرفر تايه
    console.warn('[useProjects] فشل مسح سيرفر المشروع المحذوف', e);
  }
  await deleteProjectData(projectId);
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoaded = useRef(false);

  // بيعيد قراءة القائمة من التخزين الدائم - بنناديه لما نرجع لشاشة المشاريع
  // عشان وقت آخر تعديل يتحدّث بعد الشغل جوه مشروع
  const reload = useCallback(async () => {
    const list = await readProjects();
    setProjects(list);
    setIsLoaded(true);
  }, []);

  // أول ما التطبيق يفتح: نحمّل قائمة المشاريع المحفوظة فعليًا من التخزين الدائم
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    reload();
  }, [reload]);

  const addProject = (name: string, language: 'typescript' | 'javascript') => {
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      language,
      lastModified: new Date().toISOString(),
    };
    setProjects((prev) => {
      const next = [newProject, ...prev];
      saveProjectsList(next);
      return next;
    });
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveProjectsList(next);
      return next;
    });
    // التنظيف بيحصل في الخلفية عشان الحذف يبان فوري للمستخدم
    cleanupProjectData(id);
  };

  return { projects, isLoaded, addProject, deleteProject, reload };
}