// src/utils/projectEvents.ts
// نظام أحداث بسيط: أي جزء في التطبيق (الطرفية، وبعدين الـ MCP) يغيّر ملفات مشروع
// بيبلّغ هنا، وشاشة الملفات (وأي حد تاني) بتسمع وتعيد تحميل القايمة

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

// بيسجّل مستمع لتغيّر ملفات مشروع معين، وبيرجّع دالة لإلغاء الاشتراك
export function onProjectFilesChanged(projectId: string, listener: Listener): () => void {
  const set = listeners.get(projectId) ?? new Set<Listener>();
  listeners.set(projectId, set);
  set.add(listener);

  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(projectId);
  };
}

// بيبلّغ كل المستمعين إن ملفات المشروع اتغيرت
export function emitProjectFilesChanged(projectId: string): void {
  listeners.get(projectId)?.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.warn('[projectEvents] مستمع فشل', e);
    }
  });
}