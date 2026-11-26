// src/ai/agentTools.ts
// أدوات الكتابة لوضع التنفيذ (write_file / edit_file / delete_file). كل كتابة بتروح لمنطقة الانتظار
// (Workspace) ومبتتطبّقش على المشروع غير بموافقة المستخدم. بتحجب الأسرار والثنائي والمسارات المتجاهلة.
import { isValidName } from '../terminal/vfs';
import { contentVerdict } from './contextFiles';
import { executeTool, normalizePath, READ_TOOLS, toolsInstructions } from './tools';
import type { ToolCall, ToolDef, ToolResult } from './toolTypes';
import type { Workspace } from './workspace';

export const MAX_CHANGED_FILES = 20;
export const MAX_WRITE_CHARS = 100000;
export const MAX_PATH_CHARS = 200;
export const AGENT_MAX_STEPS = 20;

export const WRITE_TOOLS: ToolDef[] = [
  {
    name: 'write_file',
    description: 'Create a file or replace a whole file with new content. Prefer edit_file for small changes to an existing file.',
    params: {
      path: { type: 'string', description: 'File path, e.g. "src/utils/format.ts". Folders are created automatically.' },
      content: { type: 'string', description: 'The full new content of the file.' },
    },
    required: ['path', 'content'],
  },
  {
    name: 'edit_file',
    description: 'Replace one exact piece of text in an existing file. old_str must match exactly once (including spaces and line breaks). Read the file first.',
    params: {
      path: { type: 'string', description: 'Existing file path.' },
      old_str: { type: 'string', description: 'The exact text to replace. Must appear exactly once.' },
      new_str: { type: 'string', description: 'The replacement text.' },
    },
    required: ['path', 'old_str', 'new_str'],
  },
  {
    name: 'delete_file',
    description: 'Delete an existing file.',
    params: { path: { type: 'string', description: 'Existing file path.' } },
    required: ['path'],
  },
];

export const AGENT_TOOLS: ToolDef[] = [...READ_TOOLS, ...WRITE_TOOLS];
const WRITE_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

export function agentInstructions(): string {
  return [
    toolsInstructions().replace('They are read-only.', 'Reading is read-only.'),
    'AGENT MODE: you can also change the project with write_file, edit_file and delete_file.',
    'Your changes are only proposed: nothing is saved until the user approves them, and you can see your own pending changes when you read files.',
    'Work like a careful engineer: read the relevant files first (never guess their contents or exports), keep changes small and focused, prefer edit_file for existing files, and do not touch files unrelated to the request.',
    'Never write secrets, API keys or tokens. When you are done, reply with a short summary of what you changed and what the user should check.',
  ].join('\n');
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function err(call: ToolCall, content: string): ToolResult {
  return { callId: call.id, name: call.name, native: call.native, content, isError: true };
}
function ok(call: ToolCall, content: string): ToolResult {
  return { callId: call.id, name: call.name, native: call.native, content };
}

// مسار صالح داخل المشروع (من غير .. أو مسار مطلق أو أسماء غريبة)
export function checkPath(raw: string | undefined): { path: string } | { error: string } {
  if (!raw || !raw.trim()) return { error: 'missing "path"' };
  const path = normalizePath(raw);
  if (!path) return { error: 'invalid path' };
  if (path.length > MAX_PATH_CHARS) return { error: 'path is too long' };
  const segs = path.split('/');
  if (segs.some((s) => !isValidName(s))) return { error: `invalid path: ${path} (no "..", empty or odd segments)` };
  return { path };
}

function verdictError(path: string, content: string): string | null {
  const v = contentVerdict(path, content.length ? content : 'x');
  if (v === 'path') return `${path} is not writable (ignored or secret path)`;
  if (v === 'binary') return `${path}: binary content is not allowed`;
  if (v === 'secret') return `${path}: the content looks like it contains a secret or API key, blocked`;
  return null;
}

// ملف أو مجلد بنفس الاسم؟
function shapeConflict(ws: Workspace, path: string): string | null {
  const all = ws.paths();
  if (all.some((p) => p.startsWith(path + '/'))) return `${path} is a folder, not a file`;
  const segs = path.split('/');
  for (let i = 1; i < segs.length; i++) {
    const prefix = segs.slice(0, i).join('/');
    if (all.includes(prefix)) return `${prefix} is a file, so ${path} cannot be created inside it`;
  }
  return null;
}

async function write(call: ToolCall, ws: Workspace): Promise<ToolResult> {
  const content = str(call.args.content);
  if (content === undefined) return err(call, 'missing "content" (string)');
  const p = checkPath(str(call.args.path));
  if ('error' in p) return err(call, p.error);
  const path = ws.resolve(p.path);
  if (content.length > MAX_WRITE_CHARS) return err(call, `content is too large (max ${MAX_WRITE_CHARS} characters). Split it into several files.`);
  const bad = verdictError(path, content);
  if (bad) return err(call, bad);
  const shape = shapeConflict(ws, path);
  if (shape) return err(call, shape);
  if (!ws.isStaged(path) && ws.stagedCount() >= MAX_CHANGED_FILES) return err(call, `too many changed files (max ${MAX_CHANGED_FILES} per run)`);
  const how = await ws.write(path, content);
  const lines = content === '' ? 0 : content.split(/\r?\n/).length;
  return ok(call, `Proposed: ${how} ${path} (${lines} lines). Not saved until the user approves.`);
}

async function edit(call: ToolCall, ws: Workspace): Promise<ToolResult> {
  const oldStr = str(call.args.old_str);
  const newStr = str(call.args.new_str);
  if (!oldStr) return err(call, 'missing "old_str"');
  if (newStr === undefined) return err(call, 'missing "new_str"');
  const p = checkPath(str(call.args.path));
  if ('error' in p) return err(call, p.error);
  const path = ws.resolve(p.path);
  const current = await ws.read(path);
  if (current === null) return err(call, `file not found: ${path}. Use list_files, or write_file to create it.`);
  const count = current.split(oldStr).length - 1;
  if (count === 0) return err(call, `old_str was not found in ${path}. It must match exactly, including spaces and line breaks. Read the file again.`);
  if (count > 1) return err(call, `old_str appears ${count} times in ${path}. Include more surrounding text so it matches exactly once.`);
  const next = current.replace(oldStr, () => newStr);
  if (next.length > MAX_WRITE_CHARS) return err(call, `the file would exceed ${MAX_WRITE_CHARS} characters`);
  const bad = verdictError(path, next);
  if (bad) return err(call, bad);
  if (!ws.isStaged(path) && ws.stagedCount() >= MAX_CHANGED_FILES) return err(call, `too many changed files (max ${MAX_CHANGED_FILES} per run)`);
  await ws.write(path, next);
  return ok(call, `Proposed: edited ${path}. Not saved until the user approves.`);
}

async function remove(call: ToolCall, ws: Workspace): Promise<ToolResult> {
  const p = checkPath(str(call.args.path));
  if ('error' in p) return err(call, p.error);
  const path = ws.resolve(p.path);
  if (!ws.exists(path)) return err(call, `file not found: ${path}`);
  const bad = verdictError(path, 'x');
  if (bad) return err(call, bad);
  if (!ws.isStaged(path) && ws.stagedCount() >= MAX_CHANGED_FILES) return err(call, `too many changed files (max ${MAX_CHANGED_FILES} per run)`);
  await ws.remove(path);
  return ok(call, `Proposed: delete ${path}. Not done until the user approves.`);
}

export async function executeAgentTool(call: ToolCall, ws: Workspace): Promise<ToolResult> {
  if (!WRITE_NAMES.has(call.name)) return executeTool(call, ws.toolContext());
  if (call.argsError) return err(call, `invalid arguments: ${call.argsError}`);
  try {
    if (call.name === 'write_file') return await write(call, ws);
    if (call.name === 'edit_file') return await edit(call, ws);
    return await remove(call, ws);
  } catch (e) {
    return err(call, String((e as Error)?.message || e));
  }
}
