// src/theme/useProjects.ts
import { useState } from 'react';
import { Project } from './types';

// بيانات مبدئية للتجربة - هنستبدلها بتخزين حقيقي بعدين
const initialProjects: Project[] = [
  {
    id: '1',
    name: 'Formix Mobile',
    language: 'typescript',
    lastModified: 'منذ 3 ساعات',
  },
];

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);

  const addProject = (name: string, language: 'typescript' | 'javascript') => {
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      language,
      lastModified: 'الآن',
    };
    setProjects((prev) => [newProject, ...prev]);
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return { projects, addProject, deleteProject };
}