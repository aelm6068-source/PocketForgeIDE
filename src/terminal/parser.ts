// تقسيم سطر الأوامر: علامات اقتباس، | ، > ، >> ، && ، ;

export interface WordToken {
  kind: 'word';
  value: string;
  quoted: boolean;
}
export interface OpToken {
  kind: 'op';
  value: '|' | '>' | '>>' | '&&' | ';';
}
export type Token = WordToken | OpToken;

export class ParseError extends Error {
  code: 'unterminated_quote' | 'syntax';
  constructor(code: 'unterminated_quote' | 'syntax') {
    super(code);
    this.code = code;
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let cur = '';
  let has = false;
  let quoted = false;
  const push = (): void => {
    if (has) tokens.push({ kind: 'word', value: cur, quoted });
    cur = '';
    has = false;
    quoted = false;
  };
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      push();
      i++;
    } else if (c === '\\') {
      if (i + 1 < line.length) {
        cur += line[i + 1];
        has = true;
        quoted = true;
        i += 2;
      } else {
        i++;
      }
    } else if (c === "'") {
      const end = line.indexOf("'", i + 1);
      if (end < 0) throw new ParseError('unterminated_quote');
      cur += line.slice(i + 1, end);
      has = true;
      quoted = true;
      i = end + 1;
    } else if (c === '"') {
      i++;
      let closed = false;
      while (i < line.length) {
        const d = line[i];
        if (d === '\\' && i + 1 < line.length && (line[i + 1] === '"' || line[i + 1] === '\\')) {
          cur += line[i + 1];
          i += 2;
        } else if (d === '"') {
          closed = true;
          i++;
          break;
        } else {
          cur += d;
          i++;
        }
      }
      if (!closed) throw new ParseError('unterminated_quote');
      has = true;
      quoted = true;
    } else if (c === '|') {
      push();
      tokens.push({ kind: 'op', value: '|' });
      i++;
    } else if (c === ';') {
      push();
      tokens.push({ kind: 'op', value: ';' });
      i++;
    } else if (c === '&' && line[i + 1] === '&') {
      push();
      tokens.push({ kind: 'op', value: '&&' });
      i += 2;
    } else if (c === '>') {
      push();
      if (line[i + 1] === '>') {
        tokens.push({ kind: 'op', value: '>>' });
        i += 2;
      } else {
        tokens.push({ kind: 'op', value: '>' });
        i++;
      }
    } else {
      cur += c;
      has = true;
      i++;
    }
  }
  push();
  return tokens;
}

export interface SimpleCommand {
  argv: WordToken[];
  redirect: { mode: '>' | '>>'; target: WordToken } | null;
}
export interface Pipeline {
  commands: SimpleCommand[];
}
export interface Statement {
  pipeline: Pipeline;
  /** كيف يرتبط بما قبله */
  joiner: ';' | '&&';
}

export function parse(tokens: Token[]): Statement[] {
  const statements: Statement[] = [];
  let commands: SimpleCommand[] = [];
  let cur: SimpleCommand = { argv: [], redirect: null };
  let joiner: ';' | '&&' = ';';

  const isEmpty = (c: SimpleCommand): boolean => c.argv.length === 0 && !c.redirect;

  const finishPipeline = (next: ';' | '&&' | null): void => {
    if (isEmpty(cur)) {
      if (commands.length > 0) throw new ParseError('syntax'); // انتهى بـ |
      if (next === '&&') throw new ParseError('syntax');
      if (next === null && joiner === '&&') throw new ParseError('syntax');
    } else {
      commands.push(cur);
    }
    if (commands.length) statements.push({ pipeline: { commands }, joiner });
    commands = [];
    cur = { argv: [], redirect: null };
    if (next) joiner = next;
  };

  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk.kind === 'word') {
      cur.argv.push(tk);
    } else if (tk.value === '>' || tk.value === '>>') {
      const target = tokens[i + 1];
      if (!target || target.kind !== 'word' || cur.redirect) throw new ParseError('syntax');
      cur.redirect = { mode: tk.value, target };
      i++;
    } else if (tk.value === '|') {
      if (isEmpty(cur)) throw new ParseError('syntax');
      commands.push(cur);
      cur = { argv: [], redirect: null };
    } else {
      finishPipeline(tk.value);
    }
  }
  finishPipeline(null);
  return statements;
}