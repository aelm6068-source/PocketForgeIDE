// src/github/linkStore.ts
// ربط كل مشروع بمستودعه على GitHub (مستودع واحد لكل مشروع). بنحفظ كمان
// blob sha لكل ملف وقت آخر رفع، عشان نعرف بعد كده أي الملفات اتغيرت.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GithubLink {
  owner: string;
  repo: string;
  branch: string;
  htmlUrl: string;
  isPrivate: boolean;
  headSha: string;
  // path -> blob sha وقت آخر رفع
  files: Record<string, string>;
}

const linkKey = (projectId: string) => `pocketforge_github_link_${projectId}`;

export async function loadGithubLink(projectId: string): Promise<GithubLink | null> {
  try {
    const raw = await AsyncStorage.getItem(linkKey(projectId));
    if (!raw) return null;
    const link = JSON.parse(raw) as Partial<GithubLink>;
    if (!link.owner || !link.repo || !link.branch) return null;
    return {
      owner: link.owner,
      repo: link.repo,
      branch: link.branch,
      htmlUrl: link.htmlUrl ?? `https://github.com/${link.owner}/${link.repo}`,
      isPrivate: link.isPrivate === true,
      headSha: link.headSha ?? '',
      files: link.files ?? {},
    };
  } catch (e) {
    console.warn('[githubLink] failed to load link', e);
    return null;
  }
}

export async function saveGithubLink(projectId: string, link: GithubLink): Promise<void> {
  try {
    await AsyncStorage.setItem(linkKey(projectId), JSON.stringify(link));
  } catch (e) {
    console.warn('[githubLink] failed to save link', e);
  }
}

export async function clearGithubLink(projectId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(linkKey(projectId));
  } catch (e) {
    console.warn('[githubLink] failed to clear link', e);
  }
}