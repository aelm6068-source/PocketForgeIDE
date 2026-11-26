// src/ai/deviceMedia.ts
// إرفاق صور وفيديو من الجهاز. الصورة بتتصغّر وتتضغط قبل الإرسال، والفيديو بيتحوّل للقطات (صور).
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { ChatImage } from './providers';
import { IMAGE_MAX_DIM, MAX_IMAGE_B64, VIDEO_FRAMES, frameKey, frameTimes, kindOf, sizeOk } from './attachLimits';

export interface MediaAttachment {
  name: string;
  kind: 'image' | 'video';
  images: ChatImage[];
}
export interface MediaPick {
  items: MediaAttachment[];
  skipped: number;
}

// تصغير (لو أكبر من الحد) + ضغط JPEG لحد ما الحجم يناسب المزوّدين
export async function toJpeg(uri: string): Promise<ChatImage | null> {
  let ref = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.max(ref.width, ref.height) > IMAGE_MAX_DIM) {
    const size = ref.width >= ref.height ? { width: IMAGE_MAX_DIM, height: null } : { width: null, height: IMAGE_MAX_DIM };
    ref = await ImageManipulator.manipulate(ref).resize(size).renderAsync();
  }
  for (const q of [0.8, 0.55, 0.35]) {
    const r = await ref.saveAsync({ format: SaveFormat.JPEG, compress: q, base64: true });
    if (r.base64 && r.base64.length <= MAX_IMAGE_B64) return { mime: 'image/jpeg', data: r.base64 };
  }
  return null;
}

export async function pickDeviceImages(max: number): Promise<MediaPick> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple: true, copyToCacheDirectory: true });
  if (picked.canceled) return { items: [], skipped: 0 };
  const items: MediaAttachment[] = [];
  let skipped = 0;
  for (const a of picked.assets) {
    if (items.length >= max || kindOf(a.mimeType, a.name) !== 'image' || !sizeOk('image', a.size)) {
      skipped++;
      continue;
    }
    try {
      const img = await toJpeg(a.uri);
      if (img) items.push({ name: a.name, kind: 'image', images: [img] });
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { items, skipped };
}

// فيديو واحد: لقطات موزّعة على الفيديو (لحد VIDEO_FRAMES أو الي المتاح)
export async function pickDeviceVideo(max: number): Promise<MediaPick> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'video/*', multiple: false, copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets.length) return { items: [], skipped: 0 };
  const a = picked.assets[0];
  if (kindOf(a.mimeType, a.name) !== 'video' || !sizeOk('video', a.size) || max <= 0) return { items: [], skipped: 1 };
  const images: ChatImage[] = [];
  const seen = new Set<string>();
  for (const time of frameTimes(Math.min(VIDEO_FRAMES + 2, 8))) {
    if (images.length >= Math.min(VIDEO_FRAMES, max)) break;
    try {
      const th = await VideoThumbnails.getThumbnailAsync(a.uri, { time, quality: 0.8 });
      const img = await toJpeg(th.uri);
      if (!img) continue;
      const k = frameKey(img.data);
      if (seen.has(k)) break; // وصلنا لآخر الفيديو
      seen.add(k);
      images.push(img);
    } catch {
      break;
    }
  }
  if (!images.length) return { items: [], skipped: 1 };
  return { items: [{ name: a.name, kind: 'video', images }], skipped: 0 };
}
