// src/theme/useProjects.ts
import { useState, useEffect, useRef } from 'react';
import { Project } from './types';
import { saveProjectsList, loadProjectsList } from '../utils/projectStorage';

// تبدأ فاضية - أول مشروع بيضيفه المستخدم بنفسه من زرار (+)
const initialProjects: Project[] = [];

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoaded = useRef(false);

  // أول ما التطبيق يفتح: نحمّل قائمة المشاريع المحفوظة فعليًا من التخزين الدائم
  // (قبل كده القائمة كانت بس في الذاكرة وبتتصفر مع أي reload للتطبيق)
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    loadProjectsList().then((saved) => {
      if (saved && saved.length > 0) {
        setProjects(saved);
      }
      setIsLoaded(true);
    });
  }, []);

  const addProject = (name: string, language: 'typescript' | 'javascript') => {
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      language,
      lastModified: 'الآن',
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
  };

  return { projects, isLoaded, addProject, deleteProject };
}
