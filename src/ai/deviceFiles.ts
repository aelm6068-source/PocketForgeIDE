// src/ai/deviceFiles.ts
// إرفاق ملفات نصية من الجهاز مع رسالة الذكاء الاصطناعي. بنفس حماية الأسرار والثنائي.
// الملف الكبير (لحد 100 ميجا) بيتقرا أول جزء منه بس، لأن الموديل مش بيقبل ملف كامل بالحجم ده.
import * as DocumentPicker from 'expo-document-picker';
import { contentVerdict } from './contextFiles';
import { HEAD_BYTES, kindOf, sizeOk, truncNote } from './attachLimits';

export interface Attachment {
  name: string;
  content: string;
}

// قرار قبول ملف مرفق (منطق بحت): نص صالح، مش سر ولا ثنائي
export function acceptAttachment(name: string, text: string): boolean {
  return contentVerdict(name, text) === 'ok';
}

function blobText(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(new Error('read'));
    r.readAsText(b);
  });
}

async function readHead(uri: string, size?: number): Promise<{ text: string; cut: boolean }> {
  const res = await fetch(uri);
  if (typeof size === 'number' && size <= HEAD_BYTES) return { text: await res.text(), cut: false };
  const blob = await res.blob();
  if (blob.size <= HEAD_BYTES) return { text: await blobText(blob), cut: false };
  return { text: await blobText(blob.slice(0, HEAD_BYTES)), cut: true };
}

// اختيار ملفات (مش صور ولا فيديو) من الجهاز. بيرجّع المقبول وعدد المتخطّى.
export async function pickDeviceFiles(max: number): Promise<{ files: Attachment[]; skipped: number }> {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
  if (picked.canceled) return { files: [], skipped: 0 };
  const files: Attachment[] = [];
  let skipped = 0;
  for (const a of picked.assets) {
    if (files.length >= max || kindOf(a.mimeType, a.name) !== 'file' || !sizeOk('file', a.size)) {
      skipped++;
      continue;
    }
    try {
      const { text, cut } = await readHead(a.uri, a.size);
      if (acceptAttachment(a.name, text)) files.push({ name: a.name, content: cut ? text + truncNote(a.size) : text });
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { files, skipped };
}
