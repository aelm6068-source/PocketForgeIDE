// src/ai/useAiChat.ts
// محادثة الذكاء الاصطناعي: الرسايل، الإرسال (دردشة أو خطة + ملفات سياق)، حفظ المحادثة لكل مشروع.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatImage, ChatMessage } from './providers';
import type { RouteResult } from './routedSend';
import type { SlotRole } from './slots';
import { aiErrorText } from './aiErrors';
import { buildSystemPrompt, listProjectEntries } from './projectContext';
import { clearChat, loadChat, saveChat } from './chatStore';
import { prepareRequest, type ChatMode } from './chatRequest';
import { buildFileContext, MAX_CONTEXT_FILES } from './contextFiles';
import { loadFileContent } from '../utils/projectStorage';
import type { ProjectFile } from '../screens/editor/useEditorFile';

// الإرسال بيتم عن طريق الراوتر (بيختار الخانة المناسبة ويبدّل لو واحدة فشلت)
export type RouteFn = (role: SlotRole, messages: ChatMessage[], system: string) => Promise<RouteResult>;

export interface UiMessage extends ChatMessage {
  id: number;
  failed?: boolean;
  via?: string; // اسم الخانة الي ردّت
  mode?: 'plan'; // رسالة في وضع الخطة
  ctx?: string[]; // ملفات السياق الي اتبعتت مع رسالة المستخدم
}

export interface SendOptions {
  images?: ChatImage[];
  mode?: ChatMode;
  contextIds?: string[]; // معرّفات الملفات المختارة
}

export function useAiChat(projectId: string, route: RouteFn, projectName: string, files: ProjectFile[]) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState(0); // كام ملف سياق اتخطّى في آخر إرسال
  const nextId = useRef(1);
  const busy = useRef(false);
  const system = useMemo(() => buildSystemPrompt(projectName, files), [projectName, files]);
  const entries = useMemo(() => listProjectEntries(files), [files]);

  // تحميل محادثة المشروع ده (كل مشروع ليه محادثته)
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setMessages([]);
    (async () => {
      const stored = await loadChat(projectId);
      if (!alive) return;
      nextId.current = stored.reduce((mx, m) => Math.max(mx, m.id), 0) + 1;
      setMessages(stored);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  // حفظ بعد كل تغيير (بس بعد ما التحميل يخلص، علشان منكتبش فوق محادثة محفوظة بقايمة فاضية)
  useEffect(() => {
    if (loaded && messages.length > 0) void saveChat(projectId, messages);
  }, [loaded, messages, projectId]);

  const send = useCallback(
    async (text: string, opts: SendOptions = {}) => {
      const content = text.trim();
      const mode: ChatMode = opts.mode ?? 'chat';
      const images = opts.images;
      if (!loaded || busy.current) return;
      // في وضع الخطة لازم وصف نصي
      if (mode === 'plan' ? !content : !content && !images?.length) return;
      busy.current = true;
      setError('');
      setSkipped(0);
      const userMsg: UiMessage = {
        id: nextId.current++,
        role: 'user',
        content,
        images,
        mode: mode === 'plan' ? 'plan' : undefined,
      };
      const history = messages
        .filter((m) => !m.failed)
        .map((m) => ({ role: m.role, content: m.content, images: m.images }));
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      try {
        // ملفات السياق: بتتقرا من الجهاز وقت الإرسال (المحفوظ بس، مش التعديلات الي لسه مااتحفظتش)
        let contextText = '';
        const ids = (opts.contextIds ?? []).slice(0, MAX_CONTEXT_FILES);
        if (ids.length) {
          const pathById = new Map<string, string>(entries.map((e) => [e.id, e.path]));
          const picked: { path: string; content: string | null }[] = [];
          for (const id of ids) {
            const path = pathById.get(id);
            if (!path) continue;
            picked.push({ path, content: await loadFileContent(projectId, id) });
          }
          const ctx = buildFileContext(picked);
          contextText = ctx.text;
          setSkipped(ctx.skipped.length);
          if (ctx.included.length) {
            setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, ctx: ctx.included } : m)));
          }
        }
        const req = prepareRequest({ history, text: content, images, mode, contextText, system });
        const res = await route(req.role, req.payload, req.system);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId.current++,
            role: 'assistant',
            content: res.reply,
            via: res.slot.label,
            mode: mode === 'plan' ? 'plan' : undefined,
          },
        ]);
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m)));
        setError(aiErrorText(e));
      } finally {
        busy.current = false;
        setSending(false);
      }
    },
    [loaded, messages, route, system, entries, projectId]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError('');
    setSkipped(0);
    void clearChat(projectId);
  }, [projectId]);

  return { messages, loaded, sending, error, skipped, entries, send, clear };
}
