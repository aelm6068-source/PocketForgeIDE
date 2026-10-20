// src/github/auth.ts
// تسجيل الدخول لـ GitHub بطريقة Device Flow: التطبيق بيطلب كود قصير، المستخدم
// بيكتبه في github.com/login/device ويوافق، والتطبيق بيستلم التوكن لوحده.
// الملف ده منطق صرف (fetch بس، من غير React Native) عشان نقدر نختبره لوحده،
// وبيرمي GithubAuthError بكود ثابت والواجهة هي اللي بتترجمه.
import {
  GITHUB_CLIENT_ID,
  GITHUB_SCOPE,
  GITHUB_DEVICE_CODE_URL,
  GITHUB_TOKEN_URL,
  GITHUB_API_USER_URL,
} from './config';

export type AuthErrorCode =
  | 'network'
  | 'bad_client'
  | 'flow_disabled'
  | 'expired'
  | 'denied'
  | 'cancelled'
  | 'unauthorized'
  | 'unknown';

export class GithubAuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GithubAuthError';
    this.code = code;
  }
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number; // بالثواني
  interval: number; // أقل فاصل بين محاولات السؤال، بالثواني
}

export interface GithubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

type FetchFn = typeof fetch;
type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// عدد مرات فشل الشبكة المتتالية المسموح بيها وإحنا بنسأل عن التوكن قبل ما نستسلم
const MAX_POLL_NETWORK_FAILURES = 4;

async function postJson(
  f: FetchFn,
  url: string,
  body: Record<string, string>
): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await f(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GithubAuthError('network');
  }
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new GithubAuthError('unknown', `HTTP ${res.status}`);
  }
}

function errorFromGithub(error: unknown): GithubAuthError {
  switch (error) {
    case 'incorrect_client_credentials':
      return new GithubAuthError('bad_client');
    case 'device_flow_disabled':
      return new GithubAuthError('flow_disabled');
    case 'expired_token':
      return new GithubAuthError('expired');
    case 'access_denied':
      return new GithubAuthError('denied');
    default:
      return new GithubAuthError('unknown', String(error));
  }
}

// الخطوة 1: نطلب كود الجهاز
export async function requestDeviceCode(f: FetchFn = fetch): Promise<DeviceCode> {
  const json = await postJson(f, GITHUB_DEVICE_CODE_URL, {
    client_id: GITHUB_CLIENT_ID,
    scope: GITHUB_SCOPE,
  });
  if (typeof json.error === 'string') throw errorFromGithub(json.error);
  const { device_code, user_code, verification_uri, expires_in, interval } = json;
  if (
    typeof device_code !== 'string' ||
    typeof user_code !== 'string' ||
    typeof verification_uri !== 'string'
  ) {
    throw new GithubAuthError('unknown', 'bad device code response');
  }
  return {
    deviceCode: device_code,
    userCode: user_code,
    verificationUri: verification_uri,
    expiresIn: typeof expires_in === 'number' ? expires_in : 900,
    interval: typeof interval === 'number' ? interval : 5,
  };
}

export interface PollOptions {
  // الواجهة بتحط cancelled = true عشان توقف الانتظار
  cancel?: { cancelled: boolean };
  fetchFn?: FetchFn;
  sleep?: SleepFn;
}

// الخطوة 2: نسأل GitHub كل interval ثانية لحد ما المستخدم يوافق. بترجّع التوكن.
export async function pollForToken(
  device: DeviceCode,
  options: PollOptions = {}
): Promise<string> {
  const f = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const cancel = options.cancel;
  let interval = device.interval;
  let elapsed = 0;
  let netFailures = 0;

  while (elapsed < device.expiresIn) {
    // لازم نستنى الفاصل قبل أول سؤال كمان، وإلا GitHub بيرد بـ slow_down
    await sleep(interval * 1000);
    elapsed += interval;
    if (cancel?.cancelled) throw new GithubAuthError('cancelled');

    let json: Record<string, unknown>;
    try {
      json = await postJson(f, GITHUB_TOKEN_URL, {
        client_id: GITHUB_CLIENT_ID,
        device_code: device.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });
      netFailures = 0;
    } catch (err) {
      if (err instanceof GithubAuthError && err.code === 'network') {
        netFailures += 1;
        if (netFailures >= MAX_POLL_NETWORK_FAILURES) throw err;
        continue; // انقطاع مؤقت (مثلًا والمستخدم في المتصفح)، نحاول تاني
      }
      throw err;
    }
    if (cancel?.cancelled) throw new GithubAuthError('cancelled');

    if (typeof json.access_token === 'string' && json.access_token) {
      return json.access_token;
    }
    const error = json.error;
    if (error === 'authorization_pending') continue;
    if (error === 'slow_down') {
      // GitHub بيبعت الفاصل الجديد، ولو مبعتوش نزوّد 5 ثواني
      interval = typeof json.interval === 'number' ? json.interval : interval + 5;
      continue;
    }
    throw errorFromGithub(error);
  }
  throw new GithubAuthError('expired');
}

// نجيب بيانات صاحب التوكن (بنستخدمها للتأكد إنه شغال ولعرض الاسم)
export async function fetchUser(token: string, f: FetchFn = fetch): Promise<GithubUser> {
  let res: Response;
  try {
    res = await f(GITHUB_API_USER_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    throw new GithubAuthError('network');
  }
  if (res.status === 401) throw new GithubAuthError('unauthorized');
  if (!res.ok) throw new GithubAuthError('unknown', `HTTP ${res.status}`);
  const json = (await res.json()) as { login?: string; name?: string | null; avatar_url?: string };
  if (typeof json.login !== 'string') throw new GithubAuthError('unknown', 'bad user response');
  return {
    login: json.login,
    name: typeof json.name === 'string' ? json.name : null,
    avatarUrl: typeof json.avatar_url === 'string' ? json.avatar_url : '',
  };
}