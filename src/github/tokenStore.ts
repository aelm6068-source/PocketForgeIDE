// src/github/tokenStore.ts
// تخزين توكن GitHub في SecureStore (مشفّر على الجهاز). مفاتيح SecureStore
// مينفعش فيها ":" فبنستخدم "_" زي باقي مفاتيح التطبيق.
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'pocketforge_github_token';
const LOGIN_KEY = 'pocketforge_github_login';
const AVATAR_KEY = 'pocketforge_github_avatar';

export interface StoredGithubAccount {
  token: string;
  login: string;
  avatarUrl: string;
}

export async function loadGithubAccount(): Promise<StoredGithubAccount | null> {
  try {
    const [token, login, avatarUrl] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(LOGIN_KEY),
      SecureStore.getItemAsync(AVATAR_KEY),
    ]);
    if (!token) return null;
    return { token, login: login ?? '', avatarUrl: avatarUrl ?? '' };
  } catch (err) {
    console.warn('GitHub: failed to load stored account', err);
    return null;
  }
}

export async function saveGithubAccount(account: StoredGithubAccount): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, account.token);
  await SecureStore.setItemAsync(LOGIN_KEY, account.login);
  await SecureStore.setItemAsync(AVATAR_KEY, account.avatarUrl);
}

export async function clearGithubAccount(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(LOGIN_KEY),
      SecureStore.deleteItemAsync(AVATAR_KEY),
    ]);
  } catch (err) {
    console.warn('GitHub: failed to clear stored account', err);
  }
}

// الباقي من التطبيق (مثلًا الرفع لاحقًا) بيجيب التوكن من هنا
export async function getGithubToken(): Promise<string | null> {
  return (await loadGithubAccount())?.token ?? null;
}