// src/utils/daytonaClient.ts
// طبقة الاتصال بـ Daytona API - اختبار المفتاح + إنشاء Sandbox + رفع الملفات + تشغيل expo tunnel + تنظيف السيرفرات

import { ProjectFile, buildFilePath } from '../screens/editor/useEditorFile';
import { loadFileContent } from './projectStorage';
import { File, Paths } from 'expo-file-system';
import { isImageFile } from '../theme/defaultAssets';

// يحوّل نص base64 لـ Uint8Array عشان نكتب بيانات binary حقيقية (صور) بدل نص
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const DAYTONA_API_BASE = 'https://app.daytona.io/api';
const TOOLBOX_PROXY_BASE = 'https://proxy.app.daytona.io/toolbox';
// المجلد اللي بتشتغل فيه الأوامر افتراضيًا جوا أي Sandbox (شفناه في رسائل الخطأ الفعلية:
// "Starting project at /home/daytona") - لازم نرفع الملفات هنا بالظبط عشان npm/expo يلاقوها
const SANDBOX_ROOT = '/home/daytona';

export type ConnectionTestResult = {
  success: boolean;
  message: string;
};

/**
 * يتأكد إن مفتاح Daytona API صحيح وشغال، عن طريق طلب خفيف
 * (قايمة الـ sandboxes) من غير ما ينشئ أي حاجة جديدة.
 */
export async function testDaytonaConnection(
  apiKey: string
): Promise<ConnectionTestResult> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'المفتاح فاضي' };
  }

  try {
    const response = await fetch(`${DAYTONA_API_BASE}/sandbox`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: 'المفتاح غير صحيح أو منتهي الصلاحية' };
    }

    if (!response.ok) {
      return {
        success: false,
        message: `فشل الاتصال (كود ${response.status})`,
      };
    }

    return { success: true, message: 'الاتصال ناجح - المفتاح شغال' };
  } catch (err: any) {
    return {
      success: false,
      message: 'فشل الاتصال بالإنترنت أو بسيرفر Daytona',
    };
  }
}

// ---------------------------------------------------------------------------
// إنشاء Sandbox
// ---------------------------------------------------------------------------

export class DaytonaError extends Error {}

async function daytonaFetch(
  apiKey: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new DaytonaError(
      `طلب فشل (${response.status}) على ${url}${bodyText ? ' - ' + bodyText : ''}`
    );
  }

  return response;
}

/**
 * ينشئ Sandbox جديد بصورة Node.js عشان نقدر نشغّل npm/expo جواه.
 * بيرجع الـ sandboxId اللي هنستخدمه في كل العمليات بعد كده.
 */
export async function createSandbox(apiKey: string): Promise<string> {
  const response = await daytonaFetch(apiKey, `${DAYTONA_API_BASE}/sandbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: 'node:20',
    }),
  });

  const data = await response.json();
  const sandboxId = data.id;
  if (!sandboxId) {
    throw new DaytonaError('السيرفر رجّع استجابة غريبة من غير sandbox id');
  }
  return sandboxId;
}

// ---------------------------------------------------------------------------
// رفع ملفات المشروع
// ---------------------------------------------------------------------------

async function ensureFolder(
  apiKey: string,
  sandboxId: string,
  path: string
): Promise<void> {
  // بنتجاهل فشل "already exists" لو حصل - المهم إن المجلد يبقى موجود في النهاية
  try {
    await daytonaFetch(
      apiKey,
      `${TOOLBOX_PROXY_BASE}/${sandboxId}/files/folder?path=${encodeURIComponent(path)}&mode=755`,
      { method: 'POST' }
    );
  } catch (err) {
    // نتجاهل الخطأ - على الأغلب المجلد موجود بالفعل
  }
}

async function uploadFileContent(
  apiKey: string,
  sandboxId: string,
  path: string,
  content: string
): Promise<void> {
  const fileName = path.split('/').pop() || 'file.txt';
  // React Native مش بيتعامل صح مع Blob مبني من نص مباشرة في FormData -
  // لازم نكتب المحتوى لملف حقيقي مؤقت الأول، وبعدين نرفعه بمساره (uri) الحقيقي
  const tempFile = new File(Paths.cache, `upload-${Date.now()}-${fileName}`);
  if (isImageFile(fileName)) {
    // محتوى الصور متخزن كـ base64 - لازم نحوّله لبيانات binary حقيقية قبل الكتابة
    tempFile.write(base64ToBytes(content));
  } else {
    tempFile.write(content);
  }

  const form = new FormData();
  form.append('file', {
    uri: tempFile.uri,
    name: fileName,
    type: isImageFile(fileName) ? 'image/png' : 'text/plain',
  } as any);

  const uploadUrl = `${TOOLBOX_PROXY_BASE}/${sandboxId}/files/upload?path=${encodeURIComponent(path)}`;

  try {
    // مستخدمين XMLHttpRequest هنا بدل fetch عمدًا - نسخة fetch الجديدة في Expo
    // (expo/fetch) فيها باغ معروف وغير محلول مع FormData اللي فيها ملفات
    // ("Unsupported FormDataPart implementation")، وXMLHttpRequest القديمة
    // بتدعم نفس شكل {uri, name, type} بشكل سليم من غير المشكلة دي
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${apiKey.trim()}`);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new DaytonaError(`طلب رفع الملف فشل (${xhr.status}) - ${xhr.responseText}`));
        }
      };
      xhr.onerror = () => reject(new DaytonaError('فشل الاتصال أثناء رفع الملف'));
      xhr.send(form as any);
    });
  } finally {
    try {
      tempFile.delete();
    } catch (e) {
      // مفيش مشكلة لو الحذف فشل - الملف في cache وهيتنضف تلقائيًا
    }
  }
}

export type UploadProgress = {
  done: number;
  total: number;
  currentFile: string;
};

/**
 * يرفع كل ملفات المشروع لـ Sandbox معين، محافظًا على هيكل المجلدات الحقيقي
 * (باستخدام buildFilePath). بيستدعي onProgress بعد كل ملف عشان تقدر تعرض تقدّم فعلي.
 */
export async function uploadProjectFiles(
  apiKey: string,
  sandboxId: string,
  projectId: string,
  allFiles: ProjectFile[],
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  const folders = allFiles.filter((f) => f.type === 'folder');
  const files = allFiles.filter((f) => f.type === 'file');

  // المجلدات الأول (لازم تكون موجودة قبل ما نرفعلها ملفات جواها)
  for (const folder of folders) {
    const path = `${SANDBOX_ROOT}/${buildFilePath(folder.id, allFiles)}`;
    await ensureFolder(apiKey, sandboxId, path);
  }

  let done = 0;
  for (const file of files) {
    const path = `${SANDBOX_ROOT}/${buildFilePath(file.id, allFiles)}`;
    const content = (await loadFileContent(projectId, file.id)) ?? '';
    await uploadFileContent(apiKey, sandboxId, path, content);
    done += 1;
    onProgress?.({ done, total: files.length, currentFile: path });
  }
}

// ---------------------------------------------------------------------------
// تشغيل npm install ثم expo start --tunnel
// ---------------------------------------------------------------------------

async function createSession(apiKey: string, sandboxId: string): Promise<string> {
  const sessionId = `session-${Date.now()}`;
  await daytonaFetch(
    apiKey,
    `${TOOLBOX_PROXY_BASE}/${sandboxId}/process/session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }
  );
  return sessionId;
}

async function execInSession(
  apiKey: string,
  sandboxId: string,
  sessionId: string,
  command: string,
  runAsync: boolean
): Promise<string> {
  const response = await daytonaFetch(
    apiKey,
    `${TOOLBOX_PROXY_BASE}/${sandboxId}/process/session/${sessionId}/exec`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, runAsync }),
    }
  );
  const data = await response.json();
  return data.cmdId;
}

async function getCommandLogs(
  apiKey: string,
  sandboxId: string,
  sessionId: string,
  commandId: string
): Promise<string> {
  const response = await daytonaFetch(
    apiKey,
    `${TOOLBOX_PROXY_BASE}/${sandboxId}/process/session/${sessionId}/command/${commandId}/logs`,
    { method: 'GET' }
  );
  return response.text();
}

// نمط جاهزية Metro/Expo - بندور عليه في اللوجز عشان نعرف إن السيرفر بقى شغال فعليًا
const METRO_READY_REGEX = /Metro waiting on|Waiting on|Starting Metro Bundler/i;

export type RunProgressStage = 'installing' | 'starting' | 'ready' | 'failed';

export type RunProgress = {
  stage: RunProgressStage;
  message: string;
  tunnelUrl?: string;
};

/**
 * يجيب رابط معاينة موقّع (signed) لبورت معين جوا Sandbox من Daytona نفسه -
 * الرابط ده بيتضمن التوكن جواه (من غير ما نحتاج أي header إضافي)، وده بديل مباشر
 * وأكتر ثباتًا من tunnel بتاع Expo (اللي بيعتمد على ngrok الخارجي وبيفشل كتير).
 */
async function getSignedPreviewUrl(
  apiKey: string,
  sandboxId: string,
  port: number,
  expiresInSeconds: number = 3600
): Promise<{ url: string; token?: string }> {
  const response = await daytonaFetch(
    apiKey,
    `${DAYTONA_API_BASE}/sandbox/${sandboxId}/ports/${port}/signed-preview-url?expiresInSeconds=${expiresInSeconds}`,
    { method: 'GET' }
  );
  return response.json();
}

/**
 * يشغّل npm install ثم expo start (من غير --tunnel خالص، يعني من غير أي اعتماد على
 * ngrok) جوا Sandbox، وبعد ما Metro يبقى جاهز، بياخد رابط معاينة عام من Daytona
 * نفسه لبورت 8081 ويحوّله لصيغة exp:// عشان Expo Go يقدر يفتحه مباشرة.
 */
export async function runExpoTunnel(
  apiKey: string,
  sandboxId: string,
  onProgress: (progress: RunProgress) => void,
  expoToken?: string
): Promise<string> {
  const sessionId = await createSession(apiKey, sandboxId);
  const METRO_PORT = 8081;

  // نجيب رابط المعاينة الأول (قبل ما نشغّل حاجة) عشان نقدر نبلّغ Metro بيه
  // كمتغيرات بيئة - من غيرها Metro بيفتكر إنه شغال محليًا ويوجّه Expo Go
  // لـ 127.0.0.1 (مش وصول من الموبايل)
  onProgress({ stage: 'installing', message: 'جاري تجهيز رابط المعاينة...' });
  const preview = await getSignedPreviewUrl(apiKey, sandboxId, METRO_PORT, 3600);
  const previewUrl = preview.url;
  const previewHost = previewUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  onProgress({ stage: 'installing', message: 'جاري تثبيت الحزم وتشغيل خادم Expo...' });
  // ملحوظة: مبقيناش محتاجين توكن Expo أو @expo/ngrok خالص هنا، لأننا مش بنستخدم
  // tunnel بتاع Expo أصلًا - العرض العام بيحصل عبر Daytona preview URL مباشرة
  //
  // مهم: npm install وتشغيل expo لازم يبقوا في نفس الأمر المتصل بـ && (مش
  // استدعائين منفصلين) - جرّبنا قبل كده استدعاء npm install لوحده بـ
  // runAsync:false على افتراض إنه هيستنى التثبيت يخلص، لكنه مبيستناش فعليًا
  // بشكل موثوق، فكان expo start بيتشغل قبل ما التثبيت يخلص ("module 'expo' is
  // not installed"). الدمج في أمر واحد بيضمن إن الشل نفسه يستنى.
  //
  // EXPO_PACKAGER_PROXY_URL و REACT_NATIVE_PACKAGER_HOSTNAME بيخلوا Metro يبلّغ
  // عن العنوان العام الصح بدل 127.0.0.1 (نفس الطريقة اللي Replit وDaytona بيستخدموها).
  // وقبلها بنقفل أي سيرفر قديم شغال على نفس البورت من محاولة سابقة (لو الـ Sandbox معاد استخدامه)
  const runCommandId = await execInSession(
    apiKey,
    sandboxId,
    sessionId,
    `pkill -f "expo start" 2>/dev/null; pkill -f "metro" 2>/dev/null; sleep 1; export EXPO_PACKAGER_PROXY_URL="${previewUrl}"; export REACT_NATIVE_PACKAGER_HOSTNAME="${previewHost}"; cd ${SANDBOX_ROOT} && npm install --legacy-peer-deps && CI=1 npx expo start --port ${METRO_PORT}`,
    true
  );

  // بننتظر لحد ما Metro يبقى جاهز فعليًا (بنراقب اللوجز)، بحد أقصى 3 دقايق
  const maxAttempts = 60;
  let lastLogError: string | null = null;
  let lastLogsSnapshot = '';
  let metroReady = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    let logs = '';
    try {
      logs = await getCommandLogs(apiKey, sandboxId, sessionId, runCommandId);
      lastLogError = null;
      if (logs) lastLogsSnapshot = logs;
    } catch (err: any) {
      lastLogError = err?.message ?? 'خطأ غير معروف أثناء قراءة اللوجز';
      continue;
    }

    if (/npm error|npm ERR!/i.test(logs)) {
      onProgress({ stage: 'failed', message: 'فشل npm install' });
      throw new DaytonaError(`فشل تثبيت الحزم:\n${logs.slice(-500)}`);
    }

    onProgress({
      stage: 'starting',
      message: `جاري تشغيل خادم Expo... (${attempt + 1}/${maxAttempts})`,
    });

    if (METRO_READY_REGEX.test(logs)) {
      metroReady = true;
      break;
    }
  }

  if (!metroReady) {
    onProgress({ stage: 'failed', message: 'محصلش خادم Expo متجهز خلال الوقت المتوقع' });
    const snapshotPreview = lastLogsSnapshot
      ? `آخر محتوى من اللوجز:\n${lastLogsSnapshot.slice(-500)}`
      : 'اللوجز رجعت فاضية طول الوقت';
    throw new DaytonaError(
      lastLogError
        ? `انتهى الوقت المسموح - آخر خطأ في قراءة اللوجز: ${lastLogError}`
        : `انتهى الوقت المسموح من غير ما يبقى Metro جاهز.\n${snapshotPreview}`
    );
  }

  // نستخدم نفس رابط المعاينة اللي جهزناه بالظبط (بدل ما نطلبه تاني) عشان يتطابق مع اللي Metro اتظبط عليه
  const expUrl = previewUrl.replace(/^https?:\/\//, 'exp://');

  onProgress({ stage: 'ready', message: 'التطبيق شغال - الرابط جاهز', tunnelUrl: expUrl });
  return expUrl;
}

// ---------------------------------------------------------------------------
// ⭐ الجديد: تنظيف الـ Sandboxes - مسح سيرفر مشروع معين + تنضيف أي سيرفرات تايهة
// ---------------------------------------------------------------------------

export type DaytonaSandboxInfo = {
  id: string;
};

/**
 * يجيب قائمة بكل الـ Sandboxes الموجودة فعليًا على حساب المستخدم في Daytona
 */
export async function listSandboxes(apiKey: string): Promise<DaytonaSandboxInfo[]> {
  const response = await daytonaFetch(apiKey, `${DAYTONA_API_BASE}/sandbox`, {
    method: 'GET',
  });
  const data = await response.json();
  // الرد بييجي بصيغة { items: [...], nextCursor: ... } مش array مباشرة
  const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
  return items.map((item: any) => ({ id: item.id }));
}

/**
 * يحذف Sandbox واحد بالـ id بتاعه. بنتجاهل خطأ 404 (يبقى أصلًا اتمسح أو مات
 * لوحده) عشان عملية التنظيف الجماعية متقفش على sandbox واحد مش موجود.
 */
export async function deleteSandbox(apiKey: string, sandboxId: string): Promise<void> {
  try {
    await daytonaFetch(apiKey, `${DAYTONA_API_BASE}/sandbox/${sandboxId}`, {
      method: 'DELETE',
    });
  } catch (err: any) {
    if (!err?.message?.includes('404') && !err?.message?.includes('409')) {
      throw err;
    }
  }
}