// مُشغّل الجافاسكربت (الجزء 3 من 3): الوحدات المدمجة وprocess وrequire والتشغيل
// نص JavaScript خام بيتجمّع مع الأجزاء الباقية في jsRunnerHtml.ts
export const RUNNER_PART_3 = String.raw`
// ---------- EventEmitter / util / assert / os ----------
function EventEmitter() { this._events = {}; }
EventEmitter.prototype.on = EventEmitter.prototype.addListener = function (n, f) {
  if (!this._events) this._events = {};
  (this._events[n] = this._events[n] || []).push(f);
  return this;
};
EventEmitter.prototype.prependListener = function (n, f) {
  if (!this._events) this._events = {};
  (this._events[n] = this._events[n] || []).unshift(f);
  return this;
};
EventEmitter.prototype.once = function (n, f) {
  var self = this;
  function w() { self.off(n, w); return f.apply(self, arguments); }
  w.listener = f;
  return this.on(n, w);
};
EventEmitter.prototype.off = EventEmitter.prototype.removeListener = function (n, f) {
  var l = this._events && this._events[n];
  if (!l) return this;
  for (var i = l.length - 1; i >= 0; i--) if (l[i] === f || l[i].listener === f) { l.splice(i, 1); break; }
  return this;
};
EventEmitter.prototype.removeAllListeners = function (n) { if (n === undefined) this._events = {}; else if (this._events) delete this._events[n]; return this; };
EventEmitter.prototype.emit = function (n) {
  var l = this._events && this._events[n];
  var args = Array.prototype.slice.call(arguments, 1);
  if (!l || !l.length) {
    if (n === 'error') throw args[0] instanceof Error ? args[0] : new Error('Unhandled error. (' + inspect(args[0]) + ')');
    return false;
  }
  l.slice().forEach(function (f) { f.apply(this, args); }, this);
  return true;
};
EventEmitter.prototype.listenerCount = function (n) { var l = this._events && this._events[n]; return l ? l.length : 0; };
EventEmitter.prototype.listeners = function (n) { return ((this._events && this._events[n]) || []).slice(); };
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.default = EventEmitter;

function deepEq(a, b, strict) {
  if (strict ? Object.is(a, b) : (a == b || (a !== a && b !== b))) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    var okm = true;
    a.forEach(function (v, k) { if (!b.has(k) || !deepEq(v, b.get(k), strict)) okm = false; });
    return okm;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    var oks = true;
    a.forEach(function (v) { if (!b.has(v)) oks = false; });
    return oks;
  }
  var ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (var i = 0; i < ka.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !deepEq(a[ka[i]], b[ka[i]], strict)) return false;
  }
  return true;
}
function AssertionError(msg, actual, expected, op) {
  var e = new Error(msg);
  e.name = 'AssertionError';
  e.code = 'ERR_ASSERTION';
  e.actual = actual; e.expected = expected; e.operator = op;
  return e;
}
function assertFail(cond, msg, def, a, b, op) {
  if (cond) return;
  if (msg instanceof Error) throw msg;
  throw AssertionError(msg || def, a, b, op);
}
var assertMod = function assert(v, m) { assertFail(!!v, m, 'The expression evaluated to a falsy value:\n\n  assert(' + inspect(v) + ')\n', v, true, '=='); };
assertMod.ok = assertMod;
assertMod.equal = function (a, b, m) { assertFail(a == b, m, inspect(a) + ' == ' + inspect(b), a, b, '=='); };
assertMod.notEqual = function (a, b, m) { assertFail(a != b, m, inspect(a) + ' != ' + inspect(b), a, b, '!='); };
assertMod.strictEqual = function (a, b, m) { assertFail(Object.is(a, b), m, 'Expected values to be strictly equal:\n\n' + inspect(a) + ' !== ' + inspect(b) + '\n', a, b, 'strictEqual'); };
assertMod.notStrictEqual = function (a, b, m) { assertFail(!Object.is(a, b), m, 'Expected "actual" to be strictly unequal to: ' + inspect(b), a, b, 'notStrictEqual'); };
assertMod.deepEqual = function (a, b, m) { assertFail(deepEq(a, b, false), m, 'Expected values to be loosely deep-equal:\n\n' + inspect(a) + '\n\nshould loosely deep-equal\n\n' + inspect(b), a, b, 'deepEqual'); };
assertMod.deepStrictEqual = function (a, b, m) { assertFail(deepEq(a, b, true), m, 'Expected values to be strictly deep-equal:\n' + inspect(a) + '\n\nshould equal\n\n' + inspect(b), a, b, 'deepStrictEqual'); };
assertMod.notDeepStrictEqual = function (a, b, m) { assertFail(!deepEq(a, b, true), m, 'Expected "actual" not to be strictly deep-equal to: ' + inspect(b), a, b, 'notDeepStrictEqual'); };
assertMod.throws = function (fn, exp, m) {
  var threw = false, err;
  try { fn(); } catch (e) { threw = true; err = e; }
  assertFail(threw, typeof exp === 'string' ? exp : m, 'Missing expected exception.', undefined, exp, 'throws');
  if (typeof exp === 'function' && exp.prototype !== undefined && !(err instanceof exp)) throw err;
  if (exp instanceof RegExp) assertFail(exp.test(String(err)), m, 'The input did not match the regular expression ' + inspect(exp), err, exp, 'throws');
};
assertMod.fail = function (m) { throw AssertionError(m || 'Failed', undefined, undefined, 'fail'); };
assertMod.AssertionError = AssertionError;
assertMod.strict = assertMod;

var utilMod = {
  inspect: inspect,
  format: format,
  promisify: function (fn) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      var self = this;
      return new Promise(function (res, rej) {
        args.push(function (err, val) { if (err) rej(err); else res(val); });
        fn.apply(self, args);
      });
    };
  },
  inherits: function (c, s) { Object.setPrototypeOf(c.prototype, s.prototype); c.super_ = s; },
  isDeepStrictEqual: function (a, b) { return deepEq(a, b, true); },
  types: { isPromise: function (x) { return tagOf(x) === 'Promise'; }, isDate: function (x) { return x instanceof Date; }, isRegExp: function (x) { return x instanceof RegExp; } },
  TextEncoder: window.TextEncoder,
  TextDecoder: window.TextDecoder
};
var osMod = {
  EOL: '\n',
  platform: function () { return 'linux'; },
  type: function () { return 'Linux'; },
  arch: function () { return 'arm64'; },
  homedir: function () { return '/'; },
  tmpdir: function () { return '/tmp'; },
  hostname: function () { return 'pocketforge'; },
  cpus: function () { return []; },
  totalmem: function () { return 0; },
  freemem: function () { return 0; }
};
var timersMod = {
  setTimeout: pfSetTimeout, setInterval: pfSetInterval, setImmediate: pfSetImmediate,
  clearTimeout: clearTimer, clearInterval: clearTimer, clearImmediate: clearTimer,
  promises: {
    setTimeout: function (ms, v) { return new Promise(function (res) { pfSetTimeout(function () { res(v); }, ms); }); },
    setImmediate: function (v) { return new Promise(function (res) { pfSetImmediate(function () { res(v); }); }); }
  }
};

// ---------- process ----------
var exitCodeVal = 0;
var proc = new EventEmitter();
proc.argv = ['node'];
proc.env = {};
proc.platform = 'linux';
proc.version = 'v20.0.0-pocketforge';
proc.versions = { node: '20.0.0', pocketforge: '1' };
proc.pid = 1;
proc.arch = 'arm64';
proc.cwd = function () { return cwdPath; };
proc.chdir = function (d) { var a = absPath(d); if (!isDirPath(a)) throw mkErr('ENOENT', 'no such file or directory', 'chdir', a); cwdPath = a; };
proc.uptime = function () { return performance.now() / 1000; };
proc.nextTick = function (fn) { var a = Array.prototype.slice.call(arguments, 1); Promise.resolve().then(function () { fn.apply(null, a); }); };
proc.hrtime = function (prev) {
  var t = performance.now();
  var s = Math.floor(t / 1000), n = Math.floor((t % 1000) * 1e6);
  if (prev) { s -= prev[0]; n -= prev[1]; if (n < 0) { s--; n += 1e9; } }
  return [s, n];
};
proc.hrtime.bigint = function () { return BigInt(Math.floor(performance.now() * 1e6)); };
proc.memoryUsage = function () { return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }; };
proc.emitWarning = function (w) { writeStream('err', '(node) Warning: ' + w + '\n'); };
proc.stdout = { write: function (s) { writeStream('out', dataToText(s)); return true; }, isTTY: false, columns: 80 };
proc.stderr = { write: function (s) { writeStream('err', dataToText(s)); return true; }, isTTY: false, columns: 80 };
proc.stdin = new EventEmitter();
proc.stdin.isTTY = false;
proc.stdin.setEncoding = function () {};
proc.stdin.resume = function () {};
proc.stdin.pause = function () {};
Object.defineProperty(proc, 'exitCode', { get: function () { return exitCodeVal; }, set: function (v) { exitCodeVal = v; }, enumerable: true });
proc.exit = function (c) {
  if (c !== undefined) exitCodeVal = c;
  finish(exitCodeVal);
  throw EXIT;
};
proc.on = proc.addListener = function (n, f) {
  if (n === 'exit' || n === 'beforeExit') exitHandlers.push(f);
  return proc;
};
proc.once = proc.on;

// ---------- الوحدات ----------
var builtins = {
  fs: fsMod, 'fs/promises': fsPromises, path: pathMod, 'path/posix': pathMod, util: utilMod, events: EventEmitter,
  assert: assertMod, 'assert/strict': assertMod, os: osMod, timers: timersMod, 'timers/promises': timersMod.promises,
  process: proc, buffer: { Buffer: PFBuffer }, console: pfConsole
};
var moduleCache = {};
function Module(id, parent) {
  this.id = id; this.filename = id; this.exports = {}; this.loaded = false; this.children = []; this.parent = parent || null; this.paths = [];
}
function isFileAt(a) { return hasFile(a); }
function tryFile(a) {
  if (isFileAt(a)) return a;
  var exts = ['.js', '.json', '.cjs', '.mjs'];
  for (var i = 0; i < exts.length; i++) if (isFileAt(a + exts[i])) return a + exts[i];
  return null;
}
function tryDir(a) {
  if (!isDirPath(a)) return null;
  var pj = a + '/package.json';
  if (hasFile(pj)) {
    try {
      var main = JSON.parse(readText(pj)).main;
      if (main) {
        var m = pathMod.join(a, main);
        var r = tryFile(m) || tryIndex(m);
        if (r) return r;
      }
    } catch (e) {}
  }
  return tryIndex(a);
}
function tryIndex(a) {
  var exts = ['/index.js', '/index.json', '/index.cjs'];
  for (var i = 0; i < exts.length; i++) if (isFileAt(a + exts[i])) return a + exts[i];
  return null;
}
function notFound(req, from) {
  var e = new Error("Cannot find module '" + req + "'" + (from ? "\nRequire stack:\n- " + from : ''));
  e.code = 'MODULE_NOT_FOUND';
  e.pfName = req;
  return e;
}
function resolveModule(req, fromFile) {
  var fromDir = pathMod.dirname(fromFile);
  if (req.charAt(0) === '.' || req.charAt(0) === '/') {
    var base = req.charAt(0) === '/' ? pathMod.normalize(req) : pathMod.join(fromDir, req);
    var r = tryFile(base) || tryDir(base);
    if (r) return r;
    throw notFound(req, fromFile);
  }
  var dir = fromDir;
  for (;;) {
    var cand = (dir === '/' ? '' : dir) + '/node_modules/' + req;
    var rr = tryFile(cand) || tryDir(cand);
    if (rr) return rr;
    if (dir === '/') break;
    dir = pathMod.dirname(dir);
  }
  throw notFound(req, fromFile);
}
var probing = false;
function probeSyntax(src) {
  var info = null;
  probing = true;
  var h = function (ev) { info = { line: ev.lineno, col: ev.colno }; ev.preventDefault(); };
  window.addEventListener('error', h);
  try {
    var s = document.createElement('script');
    s.textContent = src;
    document.head.appendChild(s);
    document.head.removeChild(s);
  } catch (e) {}
  window.removeEventListener('error', h);
  probing = false;
  return info;
}
function wrapSource(code, filename) {
  if (code.slice(0, 2) === '#!') code = '//' + code.slice(2);
  return WRAP_PREFIX + code + '\n})\n//# sourceURL=' + filename;
}
function compile(code, filename) {
  var src = wrapSource(code, filename);
  try {
    return (0, eval)(src);
  } catch (e) {
    if (e instanceof SyntaxError) {
      var info = probeSyntax(src.replace(/\n\/\/# sourceURL=.*$/, ''));
      e.pfFile = filename;
      var loc = filename;
      if (info && info.line) {
        var srcLine = code.split('\n')[info.line - 1] || '';
        var col = info.line === 1 ? Math.max(0, info.col - 1 - WRAP_LEN) : Math.max(0, info.col - 1);
        loc = filename + ':' + info.line + '\n' + srcLine + '\n' + new Array(col + 1).join(' ') + '^';
      }
      e.pfLocation = loc;
    }
    throw e;
  }
}
function makeRequire(mod) {
  function req(name) {
    name = String(name);
    var bare = name.indexOf('node:') === 0 ? name.slice(5) : name;
    if (Object.prototype.hasOwnProperty.call(builtins, bare)) return builtins[bare];
    var filename = resolveModule(name, mod.filename);
    if (moduleCache[filename]) return moduleCache[filename].exports;
    var m = new Module(filename, mod);
    moduleCache[filename] = m;
    mod.children.push(m);
    try { loadModule(m); } catch (e) { delete moduleCache[filename]; throw e; }
    return m.exports;
  }
  req.resolve = function (name) {
    var bare = String(name).indexOf('node:') === 0 ? String(name).slice(5) : String(name);
    return Object.prototype.hasOwnProperty.call(builtins, bare) ? bare : resolveModule(String(name), mod.filename);
  };
  req.cache = moduleCache;
  req.main = mainModule;
  return req;
}
var mainModule = null;
function loadModule(m) {
  var text = readText(m.filename, 'open');
  userFiles[m.filename] = true;
  if (/\.json$/.test(m.filename)) {
    try { m.exports = JSON.parse(text); } catch (e) { e.message = m.filename + ': ' + e.message; throw e; }
  } else {
    var fn = compile(text, m.filename);
    fn.call(m.exports, m.exports, makeRequire(m), m, m.filename, pathMod.dirname(m.filename));
  }
  m.loaded = true;
}

// ---------- الإنهاء والأخطاء ----------
function diagFor(e) {
  if (!e) return;
  var msg = String(e && e.message);
  if (e instanceof SyntaxError && /import statement|Unexpected token 'export'|Cannot use 'import\.meta'|Unexpected identifier 'as'/.test(msg)) rawPost({ t: 'diag', code: 'esm' });
  else if (e.code === 'MODULE_NOT_FOUND' && e.pfName && e.pfName.charAt(0) !== '.' && e.pfName.charAt(0) !== '/') rawPost({ t: 'diag', code: 'npm', arg: e.pfName });
}
function fatal(e) {
  if (finished || e === EXIT) return;
  var text;
  if (e instanceof Error) text = fmtError(e);
  else text = 'Uncaught ' + inspectNested(e);
  writeStream('err', text + '\n');
  diagFor(e);
  finish(1);
}
function collectResult() {
  var outWrites = {};
  Object.keys(writes).forEach(function (k) { if (!underRemovedDir(k) || true) outWrites[k] = writes[k]; });
  var removes = [];
  Object.keys(removedFiles).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(writes, k) && !underRemovedDir(k)) removes.push(k); });
  Object.keys(removedDirs).forEach(function (k) { removes.push(k); });
  return { writes: outWrites, removes: removes, mkdirs: Object.keys(madeDirs).sort() };
}
function finish(code) {
  if (finished || exiting) return;
  exiting = true;
  exitHandlers.forEach(function (f) { try { f(code); } catch (e) {} });
  finished = true;
  clearAllTimers();
  flushStreams();
  var r = collectResult();
  rawPost({ t: 'done', code: typeof code === 'number' ? code : 0, writes: r.writes, removes: r.removes, mkdirs: r.mkdirs });
}
var errHandler = function (ev) {
  if (finished || probing) return;
  ev.preventDefault();
  fatal(ev.error !== undefined && ev.error !== null ? ev.error : new Error(ev.message));
};
window.addEventListener('error', errHandler);
window.addEventListener('unhandledrejection', function (ev) {
  if (ev.reason === EXIT) { ev.preventDefault(); return; }
  if (finished) return;
  ev.preventDefault();
  fatal(ev.reason);
});

// ---------- نقطة البداية ----------
window.__start = function (inp) {
  files = inp.files || {};
  (inp.skipped || []).forEach(function (p) { skipped[p] = true; });
  (inp.dirs || []).forEach(function (p) { baseDirs[p] = true; });
  cwdPath = inp.cwd || '/';
  window.console = pfConsole;
  window.process = proc;
  window.Buffer = PFBuffer;
  window.global = window;
  window.setTimeout = pfSetTimeout;
  window.setInterval = pfSetInterval;
  window.setImmediate = pfSetImmediate;
  window.clearTimeout = clearTimer;
  window.clearInterval = clearTimer;
  window.clearImmediate = clearTimer;
  window.fetch = pfFetch;
  var isEval = !!inp.isEval;
  var filename = isEval ? pathMod.join(cwdPath, '[eval]') : inp.filename;
  proc.argv = isEval ? ['node'].concat(inp.args || []) : ['node', filename].concat(inp.args || []);
  try {
    var m = new Module(filename, null);
    mainModule = m;
    m.id = '.';
    moduleCache[filename] = m;
    userFiles[filename] = true;
    if (isEval) {
      var fn = compile(inp.code, filename);
      m.filename = filename;
      fn.call(m.exports, m.exports, makeRequire(m), m, '[eval]', cwdPath);
      m.loaded = true;
    } else {
      m.id = '.';
      loadModule(m);
    }
  } catch (e) {
    fatal(e);
    return;
  }
  maybeFinish();
};
rawPost({ t: 'ready' });
`;