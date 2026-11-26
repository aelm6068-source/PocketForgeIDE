// src/ai/useAttachments.ts
// حالة مرفقات الجهاز في المحادثة: ملفات + صور + فيديو (لقطات)، وحدودها وملاحظاتها.
import { useCallback, useState } from 'react';
import { translate } from '../i18n/translate';
import { MAX_CONTEXT_FILES } from './contextFiles';
import { MAX_IMAGES } from './attachLimits';
import { pickDeviceFiles, type Attachment } from './deviceFiles';
import { pickDeviceImages, pickDeviceVideo, type MediaAttachment } from './deviceMedia';
import type { ChatImage } from './providers';

export function useAttachments(selectedCount: number) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [note, setNote] = useState('');

  const imageCount = media.reduce((n, m) => n + m.images.length, 0);

  const addFiles = useCallback(async () => {
    const room = MAX_CONTEXT_FILES - selectedCount - files.length;
    if (room <= 0) return setNote(translate('ctx_max').replace('{n}', String(MAX_CONTEXT_FILES)));
    try {
      const r = await pickDeviceFiles(room);
      if (r.files.length) setFiles((cur) => [...cur, ...r.files]);
      setNote(r.skipped ? translate('attach_skipped').replace('{n}', String(r.skipped)) : '');
    } catch {
      setNote(translate('attach_skipped').replace('{n}', '1'));
    }
  }, [selectedCount, files.length]);

  const addImages = useCallback(async () => {
    const room = MAX_IMAGES - imageCount;
    if (room <= 0) return setNote(translate('attach_images_max').replace('{n}', String(MAX_IMAGES)));
    try {
      const r = await pickDeviceImages(room);
      if (r.items.length) setMedia((cur) => [...cur, ...r.items]);
      setNote(r.skipped ? translate('attach_img_skipped').replace('{n}', String(r.skipped)) : '');
    } catch {
      setNote(translate('attach_img_skipped').replace('{n}', '1'));
    }
  }, [imageCount]);

  const addVideo = useCallback(async () => {
    const room = MAX_IMAGES - imageCount;
    if (room <= 0) return setNote(translate('attach_images_max').replace('{n}', String(MAX_IMAGES)));
    try {
      const r = await pickDeviceVideo(room);
      if (r.items.length) setMedia((cur) => [...cur, ...r.items]);
      setNote(r.skipped ? translate('attach_video_fail') : '');
    } catch {
      setNote(translate('attach_video_fail'));
    }
  }, [imageCount]);

  const removeFile = useCallback((i: number) => setFiles((c) => c.filter((_, j) => j !== i)), []);
  const removeMedia = useCallback((i: number) => setMedia((c) => c.filter((_, j) => j !== i)), []);
  const clear = useCallback(() => {
    setFiles([]);
    setMedia([]);
    setNote('');
  }, []);

  const images: ChatImage[] = media.flatMap((m) => m.images);
  return { files, media, images, note, setNote, addFiles, addImages, addVideo, removeFile, removeMedia, clear };
}
