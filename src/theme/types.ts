// src/theme/types.ts
// الأنواع (Types) المشتركة بين شاشات التطبيق

export type ProjectLanguage = 'typescript' | 'javascript';

export interface Project {
  id: string;
  name: string;
  language: ProjectLanguage;
  lastModified: string;
}

// شاشات الـ Stack الرئيسي (اللي بيغطي كل التطبيق)
export type RootStackParamList = {
  MainTabs: undefined;
  Files: { projectId: string; projectName: string; language: ProjectLanguage };
  Editor: { projectId: string; fileName: string; filePath: string };
  Shell: { projectId: string };
  Preview: { projectId: string };
  AIChat: { projectId: string };
};

// شاشات الشريط السفلي بس
export type MainTabParamList = {
  Projects: undefined;
  Settings: undefined;
};