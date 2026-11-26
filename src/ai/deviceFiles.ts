// src/ai/deviceFiles.ts
// إرفاق ملفات نصية من الجهاز (ملفات كود/نص) مع رسالة الذكاء الاصطناعي. بنفس حماية الأسرار والثنائي.
import * as DocumentPicker from 'expo-document-picker';
import { contentVerdict } from './contextFiles';

export const MAX_ATTACH_BYTES = 200_000;

export interface Attachment {
  name: string;
  content: string;
}

// قرار قبول ملف مرفق (منطق بحت): نص صالح، مش كبير، مش سر ولا ثنائي
export function acceptAttachment(name: string, text: string, size?: number): boolean {
  if (typeof size === 'number' && size > MAX_ATTACH_BYTES) return false;
  if (text.length > MAX_ATTACH_BYTES) return false;
  return contentVerdict(name, text) === 'ok';
}

// اختيار ملفات من الجهاز وقراءتها كنص. بيرجع المقبول وعدد المتخطّى.
export async function pickDeviceFiles(max: number): Promise<{ files: Attachment[]; skipped: number }> {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
  if (picked.canceled) return { files: [], skipped: 0 };
  const files: Attachment[] = [];
  let skipped = 0;
  for (const a of picked.assets) {
    if (files.length >= max) {
      skipped++;
      continue;
    }
    try {
      if (typeof a.size === 'number' && a.size > MAX_ATTACH_BYTES) {
        skipped++;
        continue;
      }
      const text = await (await fetch(a.uri)).text();
      if (acceptAttachment(a.name, text, a.size)) files.push({ name: a.name, content: text });
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { files, skipped };
}
