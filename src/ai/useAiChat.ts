// src/ai/useAiChat.ts
// محادثة الذكاء الاصطناعي: الرسايل، الإرسال، حفظ المحادثة لكل مشروع، وتعليمات النظام.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatImage, ChatMessage } from './providers';
import type { RouteResult } from './routedSend';
import type { SlotRole } from './slots';
import { aiErrorText } from './aiErrors';
import { buildSystemPrompt } from './projectContext';
import { clearChat, loadChat, saveChat } from './chatStore';
import type { ProjectFile } from '../screens/editor/useEditorFile';

const MAX_HISTORY = 30; // آخر 30 رسالة بس بتتبعت للمزوّد

// الإرسال بيتم عن طريق الراوتر (بيختار الخانة المناسبة ويبدّل لو واحدة فشلت)
export type RouteFn = (role: SlotRole, messages: ChatMessage[], system: string) => Promise<RouteResult>;

export interface UiMessage extends ChatMessage {
  id: number;
  failed?: boolean;
  via?: string; // اسم الخانة الي ردّت
}

export function useAiChat(projectId: string, route: RouteFn, projectName: string, files: ProjectFile[]) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(1);
  const busy = useRef(false);
  const system = useMemo(() => buildSystemPrompt(projectName, files), [projectName, files]);

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
    async (text: string, images?: ChatImage[]) => {
      const content = text.trim();
      if (!loaded || (!content && !images?.length) || busy.current) return;
      busy.current = true;
      setError('');
      const userMsg: UiMessage = { id: nextId.current++, role: 'user', content, images };
      const history = [...messages.filter((m) => !m.failed), userMsg];
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      try {
        const payload: ChatMessage[] = history
          .slice(-MAX_HISTORY)
          .map((m) => ({ role: m.role, content: m.content, images: m.images }));
        // أول رسالة لازم تبقى من المستخدم (شرط بعض المزوّدين)
        while (payload.length && payload[0].role !== 'user') payload.shift();
        const res = await route('chat', payload, system);
        setMessages((prev) => [
          ...prev,
          { id: nextId.current++, role: 'assistant', content: res.reply, via: res.slot.label },
        ]);
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m)));
        setError(aiErrorText(e));
      } finally {
        busy.current = false;
        setSending(false);
      }
    },
    [loaded, messages, route, system]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError('');
    void clearChat(projectId);
  }, [projectId]);

  return { messages, loaded, sending, error, send, clear };
}