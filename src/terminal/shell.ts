// المفسّر: يحوّل سطر الأوامر إلى تنفيذ ومخرجات

import { COMMANDS } from './commands/fileCommands';
import { ParseError, parse, tokenize } from './parser';
import type { Pipeline, WordToken } from './parser';
import { baseName, parentPath, resolvePath } from './paths';
import { FsError } from './types';
import type { CmdCtx, OutputLine, RunResult, ShellApi, Tr } from './types';
import type { VirtualFs } from './vfs';

const MAX_HISTORY = 200;

type Emit = (kind: 'out' | 'err', text: string) => void;

export class Shell implements ShellApi {
  cwd: string;
  history: string[] = [];
  lastCode = 0;
  private clearFlag = false;

  constructor(private fs: VirtualFs, private t: Tr, cwd = '/') {
    this.cwd = cwd;
  }

  commandNames(): string[] {
    return Object.keys(COMMANDS);
  }
  requestClear(): void {
    this.clearFlag = true;
  }
  clearHistory(): void {
    this.history = [];
  }
  resolve(p: string): string {
    return resolvePath(this.cwd, p);
  }

  async run(line: string): Promise<RunResult> {
    const lines: OutputLine[] = [];
    const emit: Emit = (kind, text) => {
      if (!text) return;
      const parts = text.split('\n');
      if (parts[parts.length - 1] === '') parts.pop();
      for (const p of parts) lines.push({ kind, text: p });
    };
    this.clearFlag = false;
    const trimmed = line.trim();
    if (!trimmed) return { lines, code: this.lastCode, clear: false };

    if (this.history[this.history.length - 1] !== trimmed) {
      this.history.push(trimmed);
      if (this.history.length > MAX_HISTORY) this.history.shift();
    }

    let code = 0;
    try {
      const statements = parse(tokenize(trimmed));
      await this.fs.refresh();
      for (const st of statements) {
        if (st.joiner === '&&' && code !== 0) continue;
        code = await this.runPipeline(st.pipeline, emit);
      }
    } catch (e) {
      code = 2;
      if (e instanceof ParseError) {
        emit(
          'err',
          this.t(e.code === 'unterminated_quote' ? 'term_syntax_unterminated_quote' : 'term_syntax_error') + '\n'
        );
      } else {
        emit('err', this.t('term_internal_error', { detail: e instanceof Error ? e.message : String(e) }) + '\n');
      }
    }
    this.lastCode = code;
    return { lines, code, clear: this.clearFlag };
  }

  private async runPipeline(p: Pipeline, emit: Emit): Promise<number> {
    let stdin: string | null = null;
    let code = 0;
    for (let i = 0; i < p.commands.length; i++) {
      const cmd = p.commands[i];
      const last = i === p.commands.length - 1;
      const stream = last && !cmd.redirect;
      let outBuf = '';
      const args = await this.expand(cmd.argv);

      if (args.length > 0) {
        const name = args[0];
        const fn = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : null;
        if (!fn) {
          emit('err', this.t('term_cmd_not_found', { cmd: name }) + '\n');
          code = 127;
        } else {
          const ctx: CmdCtx = {
            args: args.slice(1),
            stdin,
            fs: this.fs,
            shell: this,
            t: this.t,
            out: (s) => {
              if (stream) emit('out', s);
              else outBuf += s;
            },
            err: (s) => emit('err', s),
            resolve: (x) => this.resolve(x),
          };
          try {
            code = await fn(ctx);
          } catch (e) {
            code = 1;
            if (e instanceof FsError) {
              emit('err', `${name}: ${this.t('term_err_' + e.code, { path: e.path })}\n`);
            } else {
              emit('err', this.t('term_internal_error', { detail: e instanceof Error ? e.message : String(e) }) + '\n');
            }
          }
        }
      } else {
        code = 0;
      }

      if (cmd.redirect) {
        const target = this.resolve(cmd.redirect.target.value);
        try {
          await this.fs.writeFile(target, outBuf, cmd.redirect.mode === '>>');
        } catch (e) {
          code = 1;
          if (e instanceof FsError) emit('err', this.t('term_err_' + e.code, { path: cmd.redirect.target.value }) + '\n');
          else throw e;
        }
        stdin = '';
      } else if (!last) {
        stdin = outBuf;
      }
    }
    return code;
  }

  /** توسيع ~ و * و ? */
  private async expand(tokens: WordToken[]): Promise<string[]> {
    const result: string[] = [];
    for (const tk of tokens) {
      let v = tk.value;
      if (!tk.quoted) {
        if (v === '~') v = '/';
        else if (v.startsWith('~/')) v = '/' + v.slice(2);
      }
      if (tk.quoted || !/[*?]/.test(v)) {
        result.push(v);
        continue;
      }
      const abs = this.resolve(v);
      const dir = parentPath(abs);
      const pattern = baseName(abs);
      if (/[*?]/.test(dir)) {
        result.push(v);
        continue;
      }
      const re = new RegExp(
        '^' +
          pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]') +
          '$'
      );
      let matches: string[] = [];
      try {
        matches = this.fs
          .list(dir)
          .map((e) => e.name)
          .filter((n) => re.test(n) && (pattern.startsWith('.') || !n.startsWith('.')));
      } catch {
        matches = [];
      }
      if (!matches.length) {
        result.push(v);
        continue;
      }
      const prefix = v.includes('/') ? v.slice(0, v.lastIndexOf('/') + 1) : '';
      for (const m of matches) result.push(prefix + m);
    }
    return result;
  }
}