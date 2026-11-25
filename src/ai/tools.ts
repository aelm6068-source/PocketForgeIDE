// src/ai/tools.ts
// أدوات القراءة فقط (للموديل): عرض الملفات، قراءة ملف، بحث. مفيش أي كتابة.
// بتحجب الأسرار والملفات الثنائية والمسارات المتجاهلة بنفس قواعد ملفات السياق.
import { contentVerdict, MAX_FILE_CHARS } from './contextFiles';
import type { PathEntry } from './projectContext';
import type { ToolCall, ToolDef, ToolResult } from './toolTypes';

export const MAX_LIST = 300;
export const MAX_SEARCH_FILES = 300;
export const MAX_MATCHES = 40;
export const MAX_LINE_CHARS = 160;
export const MAX_TOOL_CHARS_TOTAL = 80000; // ميزانية الحلقة كلها

export const READ_TOOLS: ToolDef[] = [
  {
    name: 'list_files',
    description: 'List the project file paths. Optionally only those under a folder prefix.',
    params: { prefix: { type: 'string', description: 'Optional folder prefix, e.g. "src/ai". Empty lists everything.' } },
    required: [],
  },
  {
    name: 'read_file',
    description: 'Read a project file (read-only). Returns numbered lines. Use start_line and end_line to read a part of a large file.',
    params: {
      path: { type: 'string', description: 'File path exactly as listed, e.g. "src/App.tsx".' },
      start_line: { type: 'number', description: 'Optional first line to read (1-based).' },
      end_line: { type: 'number', description: 'Optional last line to read (inclusive).' },
    },
    required: ['path'],
  },
  {
    name: 'search_files',
    description: 'Case-insensitive text search across the project files. Returns "path:line: text" matches.',
    params: {
      query: { type: 'string', description: 'Text to look for (plain text, not a regex).' },
      prefix: { type: 'string', description: 'Optional folder prefix to limit the search.' },
    },
    required: ['query'],
  },
];

// تعليمات بتتضاف لتعليمات النظام لما الأدوات شغّالة
export function toolsInstructions(): string {
  return [
    'TOOLS: you can read this project with the tools list_files, read_file and search_files. They are read-only.',
    'When you need the contents of a file, call the tool instead of guessing or asking the user to paste it. Start with list_files or search_files if you do not know the exact path. Read only what you need.',
    'Files that look like secrets or binaries are blocked. When you have enough information, answer the user directly.',
  ].join('\n');
}

export interface ToolContext {
  entries: PathEntry[];
  read: (fileId: string) => Promise<string | null>;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const posInt = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
};

export function normalizePath(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/^\.?\/+/, '').replace(/\/+$/, '');
}

function prefixOf(p: string): string {
  const n = normalizePath(p);
  return n ? n + '/' : '';
}

function suggest(entries: PathEntry[], wanted: string): string[] {
  const base = wanted.split('/').pop()!.toLowerCase();
  if (!base) return [];
  return entries.filter((e) => e.path.toLowerCase().endsWith(base) || e.path.toLowerCase().includes(base)).slice(0, 5).map((e) => e.path);
}

function findEntry(entries: PathEntry[], raw: string): { entry?: PathEntry; hints: string[] } {
  const want = normalizePath(raw);
  const exact = entries.find((e) => e.path === want);
  if (exact) return { entry: exact, hints: [] };
  const ci = entries.filter((e) => e.path.toLowerCase() === want.toLowerCase());
  if (ci.length === 1) return { entry: ci[0], hints: [] };
  return { hints: suggest(entries, want) };
}

async function listFiles(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const pre = prefixOf(str(args.prefix));
  const all = ctx.entries.filter((e) => e.path.startsWith(pre));
  if (all.length === 0) return pre ? `No files under "${pre}".` : 'The project has no files.';
  const shown = all.slice(0, MAX_LIST).map((e) => e.path).join('\n');
  return all.length > MAX_LIST ? `${shown}\n… (+${all.length - MAX_LIST} more, use a prefix to narrow)` : shown;
}

async function readFile(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult['content']> {
  const path = str(args.path);
  if (!path.trim()) throw new Error('missing "path"');
  const { entry, hints } = findEntry(ctx.entries, path);
  if (!entry) throw new Error(`file not found: ${normalizePath(path)}${hints.length ? `. Similar: ${hints.join(', ')}` : '. Use list_files.'}`);
  const content = await ctx.read(entry.id);
  if (content === null) throw new Error(`could not read ${entry.path}`);
  const v = contentVerdict(entry.path, content);
  if (v === 'secret') throw new Error(`${entry.path} looks like it contains a secret, blocked`);
  if (v === 'binary') throw new Error(`${entry.path} is a binary file, blocked`);
  if (v === 'path') throw new Error(`${entry.path} is not readable (ignored or secret path)`);
  if (v === 'empty') return `${entry.path}: (empty file)`;

  const lines = content.split(/\r?\n/);
  const total = lines.length;
  const start = posInt(args.start_line) ?? 1;
  const endReq = posInt(args.end_line) ?? total;
  const end = Math.min(Math.max(endReq, start), total);
  if (start > total) throw new Error(`start_line ${start} is past the end of the file (${total} lines)`);

  const out: string[] = [];
  let chars = 0;
  let last = start - 1;
  for (let i = start - 1; i < end; i++) {
    const line = `${i + 1}| ${lines[i]}`;
    if (chars + line.length > MAX_FILE_CHARS && out.length > 0) break;
    out.push(line);
    chars += line.length + 1;
    last = i + 1;
  }
  const cut = last < end;
  const header = `${entry.path} (lines ${start}-${last} of ${total})`;
  const note = cut ? `\n… [output limit reached at line ${last}; call read_file again with start_line=${last + 1}]` : '';
  return `${header}\n${out.join('\n')}${note}`;
}

async function searchFiles(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const query = str(args.query).trim();
  if (!query) throw new Error('missing "query"');
  const q = query.toLowerCase();
  const pre = prefixOf(str(args.prefix));
  const pool = ctx.entries.filter((e) => e.path.startsWith(pre)).slice(0, MAX_SEARCH_FILES);
  const hits: string[] = [];
  let more = false;
  for (const e of pool) {
    const content = await ctx.read(e.id);
    if (content === null || contentVerdict(e.path, content) !== 'ok') continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(q)) continue;
      if (hits.length >= MAX_MATCHES) {
        more = true;
        break;
      }
      const text = lines[i].trim();
      hits.push(`${e.path}:${i + 1}: ${text.length > MAX_LINE_CHARS ? text.slice(0, MAX_LINE_CHARS) + '…' : text}`);
    }
    if (more) break;
  }
  if (hits.length === 0) return `No matches for "${query}".`;
  return more ? `${hits.join('\n')}\n… (more matches exist, narrow the query or use a prefix)` : hits.join('\n');
}

// بينفّذ طلب أداة. أي خطأ بيرجع كنتيجة isError (مش exception) علشان الموديل يشوفه ويتصرف.
export async function executeTool(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const base = { callId: call.id, name: call.name, native: call.native };
  if (call.argsError) return { ...base, content: `invalid arguments: ${call.argsError}`, isError: true };
  try {
    let content: string;
    if (call.name === 'list_files') content = await listFiles(call.args, ctx);
    else if (call.name === 'read_file') content = await readFile(call.args, ctx);
    else if (call.name === 'search_files') content = await searchFiles(call.args, ctx);
    else return { ...base, content: `unknown tool: ${call.name}`, isError: true };
    return { ...base, content };
  } catch (e) {
    return { ...base, content: String((e as Error)?.message || e), isError: true };
  }
}

// الجملة الي بتتعرض للمستخدم جنب اسم الأداة (المسار أو كلمة البحث)
export function toolArgSummary(call: ToolCall): string {
  const v = call.args.path ?? call.args.query ?? call.args.prefix;
  return typeof v === 'string' ? v.slice(0, 120) : '';
}

// غلاف بيطبّق ميزانية الإخراج الكلية على الحلقة كلها
export function withBudget(exec: (c: ToolCall) => Promise<ToolResult>, limit = MAX_TOOL_CHARS_TOTAL) {
  let used = 0;
  return async (call: ToolCall): Promise<ToolResult> => {
    if (used >= limit) {
      return { callId: call.id, name: call.name, native: call.native, isError: true, content: 'tool output budget used up. Answer with what you already have.' };
    }
    const r = await exec(call);
    used += r.content.length;
    return r;
  };
}
