// أنواع النواة المشتركة للطرفية — بدون أي اعتماد على React Native

export type NodeType = 'file' | 'folder';

export interface FsNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
}

/** طبقة التخزين: النواة لا تعرف AsyncStorage، فقط هذه الواجهة. */
export interface FsStore {
  loadNodes(): Promise<FsNode[]>;
  saveNodes(nodes: FsNode[]): Promise<void>;
  readContent(id: string): Promise<string>;
  writeContent(id: string, content: string): Promise<void>;
  deleteContent(id: string): Promise<void>;
  /** يُستدعى بعد أي تعديل (لتحديث شاشة الملفات). */
  changed?(): void;
}

export type FsErrorCode =
  | 'not_found'
  | 'exists'
  | 'not_a_dir'
  | 'is_a_dir'
  | 'not_empty'
  | 'invalid_name'
  | 'invalid_path'
  | 'root';

export class FsError extends Error {
  code: FsErrorCode;
  path: string;
  constructor(code: FsErrorCode, path: string) {
    super(`${code}: ${path}`);
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, FsError.prototype);
  }
}

export type Tr = (key: string, params?: Record<string, string | number>) => string;

export interface OutputLine {
  kind: 'out' | 'err';
  text: string;
}

export interface RunResult {
  lines: OutputLine[];
  code: number;
  clear: boolean;
}

/** ما تحتاجه الأوامر من الشِل (بدون الاعتماد على الصنف نفسه). */
export interface ShellApi {
  cwd: string;
  history: string[];
  commandNames(): string[];
  requestClear(): void;
  clearHistory(): void;
}

export interface CmdCtx {
  args: string[];
  stdin: string | null;
  fs: import('./vfs').VirtualFs;
  shell: ShellApi;
  t: Tr;
  out(text: string): void;
  err(text: string): void;
  resolve(path: string): string;
}

export type Command = (ctx: CmdCtx) => Promise<number>;