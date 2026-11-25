// src/ai/useAiChat.ts
// محادثة الذكاء الاصطناعي: الرسايل، الإرسال (دردشة أو خطة + ملفات سياق)، حفظ المحادثة لكل مشروع.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiError, type ChatImage, type ChatMessage } from './providers';
import type { RouteResult } from './routedSend';
import type { StepRouteResult } from './routedStep';
import { runToolLoop } from './toolLoop';
import { executeTool, READ_TOOLS, toolsInstructions, withBudget } from './tools';
import type { AgentMessage, ToolDef, ToolTrace } from './toolTypes';
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

export type RouteStepFn = (role: SlotRole, messages: AgentMessage[], system: string, tools: ToolDef[]) => Promise<StepRouteResult>;

export interface UiMessage extends ChatMessage {
  id: number;
  failed?: boolean;
  via?: string; // اسم الخانة الي ردّت
  mode?: 'plan'; // رسالة في وضع الخطة
  ctx?: string[]; // ملفات السياق الي اتبعتت مع رسالة المستخدم
  tools?: ToolTrace[]; // الأدوات الي استخدمها الموديل
  capped?: boolean;
}

export interface SendOptions {
  images?: ChatImage[];
  mode?: ChatMode;
  contextIds?: string[]; // معرّفات الملفات المختارة
  tools?: boolean; // السماح للموديل بقراءة ملفات المشروع (قراءة فقط)
}

export function useAiChat(projectId: string, route: RouteFn, routeStep: RouteStepFn, projectName: string, files: ProjectFile[]) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState(0); // كام ملف سياق اتخطّى في آخر إرسال
  const [activity, setActivity] = useState<ToolTrace | null>(null); // آخر أداة بتتنفّذ دلوقتي
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
        let reply: string;
        let via: string;
        let tools: ToolTrace[] | undefined;
        let capped = false;
        if (opts.tools) {
          const toolCtx = { entries, read: (id: string) => loadFileContent(projectId, id) };
          const exec = withBudget((c) => executeTool(c, toolCtx));
          const sys = `${req.system}\n\n${toolsInstructions()}`;
          const r = await runToolLoop(
            req.payload as AgentMessage[],
            {
              step: (m) => routeStep(req.role, m, sys, READ_TOOLS).then((x) => ({ step: x.step, slot: x.slot })),
              execute: exec,
              onTool: (c, res) => setActivity({ name: c.name, arg: String(c.args.path ?? c.args.query ?? c.args.prefix ?? '').slice(0, 120), ok: !res.isError }),
            },
          );
          if (!r.text.trim()) throw new AiError('bad_response', 'empty');
          reply = r.text;
          via = r.slot?.label ?? '';
          tools = r.trace.length ? r.trace.slice(0, 20) : undefined;
          capped = r.capped;
        } else {
          const res = await route(req.role, req.payload, req.system);
          reply = res.reply;
          via = res.slot.label;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: nextId.current++,
            role: 'assistant',
            content: reply,
            via,
            mode: mode === 'plan' ? 'plan' : undefined,
            tools,
            capped: capped || undefined,
          },
        ]);
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m)));
        setError(aiErrorText(e));
      } finally {
        busy.current = false;
        setSending(false);
        setActivity(null);
      }
    },
    [loaded, messages, route, routeStep, system, entries, projectId]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError('');
    setSkipped(0);
    void clearChat(projectId);
  }, [projectId]);

  return { messages, loaded, sending, error, skipped, activity, entries, send, clear };
}
