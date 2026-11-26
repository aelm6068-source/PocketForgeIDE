// src/ai/useAiChat.ts
// محادثة الذكاء الاصطناعي: الرسايل، الإرسال (دردشة أو خطة + ملفات سياق)، حفظ المحادثة لكل مشروع.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiError, type ChatImage, type ChatMessage } from './providers';
import type { RouteResult } from './routedSend';
import type { StepRouteResult } from './routedStep';
import { runToolLoop } from './toolLoop';
import { executeTool, READ_TOOLS, toolsInstructions, withBudget } from './tools';
import { agentInstructions, AGENT_MAX_STEPS, AGENT_TOOLS, executeAgentTool } from './agentTools';
import { Workspace, type Change } from './workspace';
import { applyChanges, undoChanges, type UndoOp } from './applyChanges';
import { makeProposal, type Proposal } from './proposal';
import type { Attachment } from './deviceFiles';
import { VirtualFs } from '../terminal/vfs';
import { createProjectStore } from '../terminal/projectStore';
import { translate } from '../i18n/translate';
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
  mode?: 'plan' | 'agent'; // رسالة في وضع الخطة أو التنفيذ
  ctx?: string[]; // ملفات السياق الي اتبعتت مع رسالة المستخدم
  tools?: ToolTrace[]; // الأدوات الي استخدمها الموديل
  capped?: boolean;
  proposal?: Proposal;
}

export interface SendOptions {
  images?: ChatImage[];
  mode?: ChatMode;
  contextIds?: string[]; // معرّفات الملفات المختارة
  tools?: boolean; // السماح للموديل بقراءة ملفات المشروع (قراءة فقط)
  attachments?: Attachment[]; // ملفات نصية مرفقة من الجهاز
  mediaNames?: string[]; // أسماء الصور/الفيديو المرفقة (للعرض بس)
}

export function useAiChat(projectId: string, route: RouteFn, routeStep: RouteStepFn, projectName: string, files: ProjectFile[]) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState(0); // كام ملف سياق اتخطّى في آخر إرسال
  const [activity, setActivity] = useState<ToolTrace | null>(null); // آخر أداة بتتنفّذ دلوقتي
  const nextId = useRef(1);
  // محتوى التعديلات المقترحة (في الذاكرة بس) وبيانات التراجع، لكل رسالة
  const pending = useRef(new Map<number, Change[]>());
  const undoData = useRef(new Map<number, { ops: UndoOp[]; applied: Change[] }>());
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
      // في وضع الخطة والتنفيذ لازم وصف نصي
      if (mode !== 'chat' ? !content : !content && !images?.length) return;
      busy.current = true;
      setError('');
      setSkipped(0);
      const userMsg: UiMessage = {
        id: nextId.current++,
        role: 'user',
        content,
        images,
        ctx: opts.mediaNames?.length ? opts.mediaNames : undefined,
        mode: mode === 'chat' ? undefined : mode,
      };
      const history = messages
        .filter((m) => !m.failed)
        .map((m) => ({ role: m.role, content: m.content })); // الصور بتتبعت مع رسالتها بس
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      try {
        // ملفات السياق: بتتقرا من الجهاز وقت الإرسال (المحفوظ بس، مش التعديلات الي لسه مااتحفظتش)
        let contextText = '';
        const atts = (opts.attachments ?? []).slice(0, MAX_CONTEXT_FILES);
        const ids = (opts.contextIds ?? []).slice(0, MAX_CONTEXT_FILES - atts.length);
        if (ids.length || atts.length) {
          const pathById = new Map<string, string>(entries.map((e) => [e.id, e.path]));
          const picked: { path: string; content: string | null }[] = [];
          for (const id of ids) {
            const path = pathById.get(id);
            if (!path) continue;
            picked.push({ path, content: await loadFileContent(projectId, id) });
          }
          for (const a of atts) picked.push({ path: a.name, content: a.content });
          const ctx = buildFileContext(picked);
          contextText = ctx.text;
          setSkipped(ctx.skipped.length);
          if (ctx.included.length) {
            const names = [...(opts.mediaNames ?? []), ...ctx.included];
            setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, ctx: names } : m)));
          }
        }
        const req = prepareRequest({ history, text: content, images, mode, contextText, system });
        let reply: string;
        let via: string;
        let tools: ToolTrace[] | undefined;
        let capped = false;
        const assistantId = nextId.current++;
        let proposal: Proposal | undefined;
        if (opts.tools || mode === 'agent') {
          const ws = mode === 'agent' ? new Workspace(entries, (id) => loadFileContent(projectId, id)) : null;
          const toolCtx = { entries, read: (id: string) => loadFileContent(projectId, id) };
          const exec = withBudget(ws ? (c) => executeAgentTool(c, ws) : (c) => executeTool(c, toolCtx), ws ? 150000 : undefined);
          const sys = `${req.system}\n\n${ws ? agentInstructions() : toolsInstructions()}`;
          const r = await runToolLoop(
            req.payload as AgentMessage[],
            {
              step: (m) => routeStep(req.role, m, sys, ws ? AGENT_TOOLS : READ_TOOLS).then((x) => ({ step: x.step, slot: x.slot })),
              execute: exec,
              onTool: (c, res) => setActivity({ name: c.name, arg: String(c.args.path ?? c.args.query ?? c.args.prefix ?? '').slice(0, 120), ok: !res.isError }),
            },
            ws ? AGENT_MAX_STEPS : undefined,
          );
          const ch = ws ? ws.changes() : [];
          if (ch.length) {
            pending.current.set(assistantId, ch);
            proposal = makeProposal(ch);
          }
          if (!r.text.trim() && !proposal) throw new AiError('bad_response', 'empty');
          reply = r.text.trim() ? r.text : translate('agent_no_text');
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
            id: assistantId,
            role: 'assistant',
            content: reply,
            via,
            mode: mode === 'chat' ? undefined : mode,
            tools,
            capped: capped || undefined,
            proposal,
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

  // ---------- مراجعة تعديلات وضع التنفيذ ----------
  const patchProposal = useCallback((id: number, fn: (p: Proposal) => Proposal) => {
    setMessages((prev) => prev.map((m) => (m.id === id && m.proposal ? { ...m, proposal: fn(m.proposal) } : m)));
  }, []);

  const applyProposal = useCallback(
    async (id: number, paths: string[]) => {
      const all = pending.current.get(id);
      if (!all) {
        patchProposal(id, (p) => ({ ...p, status: 'expired' }));
        return;
      }
      const chosen = all.filter((c) => paths.includes(c.path));
      if (!chosen.length) return;
      try {
        const res = await applyChanges(new VirtualFs(createProjectStore(projectId)), chosen);
        undoData.current.set(id, { ops: res.undo, applied: chosen.filter((c) => res.applied.includes(c.path)) });
        pending.current.delete(id);
        patchProposal(id, (p) => ({
          status: 'applied',
          items: p.items.map((it) => {
            const failed = res.failed.find((f) => f.path === it.path);
            return { ...it, result: res.applied.includes(it.path) ? 'applied' : failed ? failed.reason : 'skipped' };
          }),
        }));
      } catch (e) {
        setError(String((e as Error)?.message || e));
      }
    },
    [projectId, patchProposal]
  );

  const rejectProposal = useCallback(
    (id: number) => {
      pending.current.delete(id);
      patchProposal(id, (p) => ({ ...p, status: 'rejected' }));
    },
    [patchProposal]
  );

  const undoProposal = useCallback(
    async (id: number) => {
      const data = undoData.current.get(id);
      if (!data) return;
      try {
        const res = await undoChanges(new VirtualFs(createProjectStore(projectId)), data.ops, data.applied);
        undoData.current.delete(id);
        patchProposal(id, (p) => ({
          status: 'undone',
          items: p.items.map((it) =>
            res.restored.includes(it.path) ? { ...it, result: 'undone' } : res.skipped.includes(it.path) ? { ...it, result: 'undo_skipped' } : it
          ),
        }));
      } catch (e) {
        setError(String((e as Error)?.message || e));
      }
    },
    [projectId, patchProposal]
  );

  const canUndo = useCallback((id: number) => undoData.current.has(id), []);
  const getChange = useCallback(
    (id: number, path: string): Change | undefined =>
      (pending.current.get(id) ?? undoData.current.get(id)?.applied)?.find((c) => c.path === path),
    []
  );

  const clear = useCallback(() => {
    pending.current.clear();
    undoData.current.clear();
    setMessages([]);
    setError('');
    setSkipped(0);
    void clearChat(projectId);
  }, [projectId]);

  return { messages, loaded, sending, error, skipped, activity, entries, send, clear, applyProposal, rejectProposal, undoProposal, canUndo, getChange };
}
