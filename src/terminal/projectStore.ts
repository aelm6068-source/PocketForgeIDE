// src/terminal/projectStore.ts
// يربط نواة الطرفية بتخزين PocketForge الفعلي (نفس الدوال اللي شاشة الملفات والمحرر بيستخدموها)
import {
  deleteFileContent,
  loadFileContent,
  loadProjectFiles,
  saveFileContent,
  saveProjectFiles,
  touchProject,
} from '../utils/projectStorage';
import { emitProjectFilesChanged } from '../utils/projectEvents';
import type { FsNode, FsStore } from './types';

export function createProjectStore(projectId: string): FsStore {
  return {
    async loadNodes(): Promise<FsNode[]> {
      const files = await loadProjectFiles(projectId);
      return (files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        parentId: f.parentId ?? null,
      }));
    },
    async saveNodes(nodes: FsNode[]): Promise<void> {
      await saveProjectFiles(projectId, nodes);
    },
    async readContent(id: string): Promise<string> {
      return (await loadFileContent(projectId, id)) ?? '';
    },
    async writeContent(id: string, content: string): Promise<void> {
      await saveFileContent(projectId, id, content);
    },
    async deleteContent(id: string): Promise<void> {
      await deleteFileContent(projectId, id);
    },
    changed(): void {
      touchProject(projectId);
      emitProjectFilesChanged(projectId);
    },
  };
}