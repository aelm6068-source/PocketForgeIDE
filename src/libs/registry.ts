// src/libs/registry.ts
// التعامل مع npm registry (بحث + بيانات مكتبة). الشبكة بتتحقن كـ fetch علشان الاختبار.
import { manifestRisk, rangeFor, type Risk } from './pkgJson';

export type FetchFn = (url: string, init?: any) => Promise<any>;
export const REGISTRY = 'https://registry.npmjs.org';
const TIMEOUT_MS = 15000;

export class LibError extends Error {
  code: 'network' | 'not_found' | 'bad_response' | 'no_package_json' | 'invalid_name' | 'bad_package_json' | 'no_sdk_version';
  constructor(code: LibError['code'], detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    Object.setPrototypeOf(this, LibError.prototype);
  }
}

export interface SearchHit {
  name: string;
  version: string;
  description: string;
}

async function getJson(f: FetchFn, url: string): Promise<{ status: number; json: any }> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await f(url, { headers: { Accept: 'application/json' }, signal: ctl?.signal });
    if (res.status === 404) return { status: 404, json: null };
    if (!res.ok) throw new LibError('network', `HTTP ${res.status}`);
    return { status: res.status, json: await res.json() };
  } catch (e) {
    if (e instanceof LibError) throw e;
    throw new LibError('network', e instanceof Error ? e.message : 'fetch');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function searchPackages(f: FetchFn, query: string, size = 20): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const { json } = await getJson(f, `${REGISTRY}/-/v1/search?text=${encodeURIComponent(q)}&size=${size}`);
  const objs: any[] = Array.isArray(json?.objects) ? json.objects : [];
  const hits: SearchHit[] = [];
  for (const o of objs) {
    const p = o?.package;
    if (p && typeof p.name === 'string' && typeof p.version === 'string') {
      hits.push({ name: p.name, version: p.version, description: typeof p.description === 'string' ? p.description : '' });
    }
  }
  return hits;
}

export interface Resolved {
  name: string;
  version: string;
  range: string;
  risk: Risk;
  sdkTagged: boolean;
}

// بيحدد النسخة: لو المستخدم كتب نسخة/وسم نستخدمه. وإلا: لمكتبات expo/react-native بنجرّب وسم sdk-N (متوافق مع الـ SDK) ثم latest.
export async function resolveLibrary(f: FetchFn, name: string, requested: string | undefined, sdk: number | null): Promise<Resolved> {
  const scoped = (v: string) => `${REGISTRY}/${name.replace('/', '%2F')}/${encodeURIComponent(v)}`;
  const tries: { v: string; sdk: boolean }[] = [];
  if (requested) tries.push({ v: requested, sdk: false });
  else {
    if (sdk && /^(expo-|react-native-|@react-native|@expo\/)/.test(name)) tries.push({ v: `sdk-${sdk}`, sdk: true });
    tries.push({ v: 'latest', sdk: false });
  }
  for (const t of tries) {
    const { status, json } = await getJson(f, scoped(t.v));
    if (status === 404) continue;
    const version = typeof json?.version === 'string' ? json.version : '';
    if (!version) throw new LibError('bad_response', name);
    const exactRequested = requested && /^\d+\.\d+\.\d+/.test(requested);
    return {
      name,
      version,
      range: requested && !exactRequested && /[\^~<>=*xX|]/.test(requested) ? requested : rangeFor(version, t.sdk),
      risk: manifestRisk(json),
      sdkTagged: t.sdk,
    };
  }
  throw new LibError('not_found', name);
}
