// src/ai/useAiChat.ts
// محادثة الذكاء الاصطناعي: الرسايل، الإرسال، وتعليمات النظام (اسم المشروع + مسارات ملفاته).
import { useCallback, useMemo, useRef, useState } from 'react';
import { sendChat } from './providers';
import type { ChatImage, ChatMessage, ProviderId } from './providers';
import { aiErrorText } from './aiErrors';
import { buildSystemPrompt } from './projectContext';
import type { ProjectFile } from '../screens/editor/useEditorFile';

const MAX_HISTORY = 30; // آخر 30 رسالة بس بتتبعت للمزوّد

export interface UiMessage extends ChatMessage {
  id: number;
  failed?: boolean;
}

export function useAiChat(
  provider: ProviderId,
  apiKey: string,
  model: string,
  projectName: string,
  files: ProjectFile[]
) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(1);
  const busy = useRef(false);
  const system = useMemo(() => buildSystemPrompt(projectName, files), [projectName, files]);

  const send = useCallback(
    async (text: string, images?: ChatImage[]) => {
      const content = text.trim();
      if ((!content && !images?.length) || busy.current) return;
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
        const reply = await sendChat(provider, apiKey, model, system, payload);
        setMessages((prev) => [...prev, { id: nextId.current++, role: 'assistant', content: reply }]);
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m)));
        setError(aiErrorText(e));
      } finally {
        busy.current = false;
        setSending(false);
      }
    },
    [messages, provider, apiKey, model, system]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError('');
  }, []);

  return { messages, sending, error, send, clear };
}