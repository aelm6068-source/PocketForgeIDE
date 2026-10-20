// src/github/useGithubAuth.ts
// hook بيدير حالة ربط GitHub للواجهة: loading / disconnected / pending / connected
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  requestDeviceCode,
  pollForToken,
  fetchUser,
  GithubAuthError,
  AuthErrorCode,
  DeviceCode,
} from './auth';
import { loadGithubAccount, saveGithubAccount, clearGithubAccount } from './tokenStore';

export type GithubStatus = 'loading' | 'disconnected' | 'pending' | 'connected';

export interface GithubAccountInfo {
  login: string;
  avatarUrl: string;
}

export function useGithubAuth() {
  const [status, setStatus] = useState<GithubStatus>('loading');
  const [account, setAccount] = useState<GithubAccountInfo | null>(null);
  const [device, setDevice] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<AuthErrorCode | null>(null);

  // كل محاولة ربط ليها رقم، ولو اتلغت أو اتبدلت بمحاولة جديدة بنتجاهل نتيجتها
  const runId = useRef(0);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // عند الفتح: نقرا الحساب المحفوظ ونتأكد في الخلفية إن التوكن لسه شغال
  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadGithubAccount();
      if (!alive) return;
      if (!stored) {
        setStatus('disconnected');
        return;
      }
      setAccount({ login: stored.login, avatarUrl: stored.avatarUrl });
      setStatus('connected');
      try {
        const user = await fetchUser(stored.token);
        if (!alive) return;
        setAccount({ login: user.login, avatarUrl: user.avatarUrl });
      } catch (err) {
        // التوكن اتلغى من GitHub: نفصل. أي خطأ تاني (زي مفيش نت) نسيب الحساب زي ما هو
        if (alive && err instanceof GithubAuthError && err.code === 'unauthorized') {
          await clearGithubAccount();
          setAccount(null);
          setStatus('disconnected');
        }
      }
    })();
    return () => {
      alive = false;
      cancelRef.current.cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    cancelRef.current.cancelled = true;
    const cancel = { cancelled: false };
    cancelRef.current = cancel;
    const id = ++runId.current;
    const current = () => runId.current === id && !cancel.cancelled;

    setError(null);
    setDevice(null);
    setStatus('pending');
    try {
      const code = await requestDeviceCode();
      if (!current()) return;
      setDevice(code);
      const token = await pollForToken(code, { cancel });
      if (!current()) return;
      const user = await fetchUser(token);
      if (!current()) return;
      await saveGithubAccount({ token, login: user.login, avatarUrl: user.avatarUrl });
      if (!current()) return;
      setAccount({ login: user.login, avatarUrl: user.avatarUrl });
      setDevice(null);
      setStatus('connected');
    } catch (err) {
      if (!current()) return;
      const code = err instanceof GithubAuthError ? err.code : 'unknown';
      if (code !== 'cancelled') setError(code);
      setDevice(null);
      setStatus('disconnected');
    }
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current.cancelled = true;
    runId.current += 1;
    setDevice(null);
    setError(null);
    setStatus('disconnected');
  }, []);

  const disconnect = useCallback(async () => {
    await clearGithubAccount();
    setAccount(null);
    setError(null);
    setStatus('disconnected');
  }, []);

  return { status, account, device, error, connect, cancel, disconnect };
}