// مُشغّل الجافاسكربت (الجزء 2 من 3): path وBuffer ونظام الملفات والمؤقتات
// نص JavaScript خام بيتجمّع مع الأجزاء الباقية في jsRunnerHtml.ts
export const RUNNER_PART_2 = String.raw`
// ===== path (posix) و Buffer =====
function normalizeParts(parts, allowAbove) {
  var res = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (!p || p === '.') continue;
    if (p === '..') {
      if (res.length && res[res.length - 1] !== '..') res.pop();
      else if (allowAbove) res.push('..');
    } else res.push(p);
  }
  return res;
}
var pathMod = {
  sep: '/',
  delimiter: ':',
  isAbsolute: function (p) { return String(p).charAt(0) === '/'; },
  normalize: function (p) {
    p = String(p);
    if (!p) return '.';
    var abs = p.charAt(0) === '/';
    var trail = p.charAt(p.length - 1) === '/';
    var r = normalizeParts(p.split('/'), !abs).join('/');
    if (!r && !abs) r = '.';
    if (r && trail) r += '/';
    return (abs ? '/' : '') + r;
  },
  join: function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) { if (arguments[i]) parts.push(String(arguments[i])); }
    return parts.length ? pathMod.normalize(parts.join('/')) : '.';
  },
  resolve: function () {
    var resolved = '';
    var abs = false;
    for (var i = arguments.length - 1; i >= -1 && !abs; i--) {
      var p = i >= 0 ? String(arguments[i]) : (proc && proc.cwd ? proc.cwd() : '/');
      if (!p) continue;
      resolved = p + '/' + resolved;
      abs = p.charAt(0) === '/';
    }
    var r = normalizeParts(resolved.split('/'), !abs).join('/');
    return (abs ? '/' : '') + r || (abs ? '/' : '.');
  },
  dirname: function (p) {
    p = String(p);
    if (!p) return '.';
    var abs = p.charAt(0) === '/';
    var end = p.length;
    while (end > 1 && p.charAt(end - 1) === '/') end--;
    var i = p.lastIndexOf('/', end - 1);
    if (i === -1) return abs ? '/' : '.';
    if (i === 0) return '/';
    return p.slice(0, i);
  },
  basename: function (p, ext) {
    p = String(p);
    var end = p.length;
    while (end > 1 && p.charAt(end - 1) === '/') end--;
    p = p.slice(0, end);
    var b = p.slice(p.lastIndexOf('/') + 1);
    if (ext && b.length > ext.length && b.slice(-ext.length) === ext) b = b.slice(0, -ext.length);
    return b;
  },
  extname: function (p) {
    var b = pathMod.basename(p);
    var i = b.lastIndexOf('.');
    return i <= 0 ? '' : b.slice(i);
  },
  relative: function (from, to) {
    var f = pathMod.resolve(from).split('/').filter(Boolean);
    var t = pathMod.resolve(to).split('/').filter(Boolean);
    var i = 0;
    while (i < f.length && i < t.length && f[i] === t[i]) i++;
    var up = [];
    for (var j = i; j < f.length; j++) up.push('..');
    return up.concat(t.slice(i)).join('/');
  },
  parse: function (p) {
    var base = pathMod.basename(p);
    var ext = pathMod.extname(p);
    return { root: p.charAt(0) === '/' ? '/' : '', dir: pathMod.dirname(p) === '.' && p.indexOf('/') === -1 ? '' : pathMod.dirname(p), base: base, ext: ext, name: ext ? base.slice(0, -ext.length) : base };
  },
  format: function (o) {
    var dir = o.dir || o.root || '';
    var base = o.base || ((o.name || '') + (o.ext || ''));
    return dir ? (dir === o.root ? dir + base : dir + '/' + base) : base;
  }
};
pathMod.posix = pathMod;

var utf8Enc = new TextEncoder();
var utf8Dec = new TextDecoder('utf-8');
class PFBuffer extends Uint8Array {
  static from(x, enc) {
    var bytes;
    if (typeof x === 'string') {
      enc = enc || 'utf8';
      if (enc === 'hex') {
        bytes = [];
        for (var i = 0; i + 1 < x.length; i += 2) bytes.push(parseInt(x.substr(i, 2), 16));
      } else if (enc === 'base64') {
        var bin = atob(x.replace(/-/g, '+').replace(/_/g, '/'));
        bytes = [];
        for (var j = 0; j < bin.length; j++) bytes.push(bin.charCodeAt(j));
      } else if (enc === 'latin1' || enc === 'binary' || enc === 'ascii') {
        bytes = [];
        for (var k = 0; k < x.length; k++) bytes.push(x.charCodeAt(k) & 255);
      } else bytes = utf8Enc.encode(x);
    } else bytes = x;
    var b = new PFBuffer(bytes.length);
    b.set(bytes);
    return b;
  }
  static alloc(n, fill) { var b = new PFBuffer(n); if (fill) b.fill(fill); return b; }
  static isBuffer(x) { return x instanceof PFBuffer; }
  static byteLength(s) { return typeof s === 'string' ? utf8Enc.encode(s).length : s.length; }
  static concat(list) {
    var n = 0;
    list.forEach(function (b) { n += b.length; });
    var r = new PFBuffer(n);
    var o = 0;
    list.forEach(function (b) { r.set(b, o); o += b.length; });
    return r;
  }
  toString(enc) {
    enc = enc || 'utf8';
    if (enc === 'hex') {
      var h = '';
      for (var i = 0; i < this.length; i++) h += (this[i] < 16 ? '0' : '') + this[i].toString(16);
      return h;
    }
    if (enc === 'base64') {
      var s = '';
      for (var j = 0; j < this.length; j++) s += String.fromCharCode(this[j]);
      return btoa(s);
    }
    if (enc === 'latin1' || enc === 'binary' || enc === 'ascii') {
      var l = '';
      for (var k = 0; k < this.length; k++) l += String.fromCharCode(this[k]);
      return l;
    }
    return utf8Dec.decode(this);
  }
  toJSON() { return { type: 'Buffer', data: Array.prototype.slice.call(this) }; }
  equals(o) {
    if (this.length !== o.length) return false;
    for (var i = 0; i < this.length; i++) if (this[i] !== o[i]) return false;
    return true;
  }
}
// ===== الجزء B: الحالة، نظام الملفات، الوحدات، process، المؤقتات، التشغيل =====
var files = {};
var skipped = {};
var baseDirs = {};
var writes = {};
var removedFiles = {};
var removedDirs = {};
var madeDirs = {};
var cwdPath = '/';
var finished = false;
var exiting = false;
var pending = 0;
var checkScheduled = false;
var EXIT = { pfExit: true };
var exitHandlers = [];

var origSetTimeout = window.setTimeout.bind(window);
var origSetInterval = window.setInterval.bind(window);
var origClearTimeout = window.clearTimeout.bind(window);
var origClearInterval = window.clearInterval.bind(window);

function mkErr(code, msg, op, p) {
  var e = new Error(code + ': ' + msg + ', ' + op + " '" + p + "'");
  e.code = code; e.syscall = op; e.path = p;
  e.errno = code === 'ENOENT' ? -2 : code === 'EEXIST' ? -17 : code === 'EISDIR' ? -21 : code === 'ENOTDIR' ? -20 : -5;
  return e;
}
function absPath(p) {
  if (p && typeof p === 'object' && p.pathname) p = p.pathname;
  return pathMod.resolve(cwdPath, String(p));
}
function hasFile(a) {
  if (removedFiles[a]) return false;
  return Object.prototype.hasOwnProperty.call(writes, a) || Object.prototype.hasOwnProperty.call(files, a) || !!skipped[a];
}
function underRemovedDir(a) {
  for (var d in removedDirs) { if (a === d || a.indexOf(d + '/') === 0) return d; }
  return null;
}
function allFilePaths() {
  var set = {};
  Object.keys(files).forEach(function (k) { if (!removedFiles[k] && !underRemovedDir(k)) set[k] = 1; });
  Object.keys(skipped).forEach(function (k) { if (!removedFiles[k] && !underRemovedDir(k)) set[k] = 1; });
  Object.keys(writes).forEach(function (k) { set[k] = 1; });
  return Object.keys(set);
}
function isDirPath(a) {
  if (a === '/') return true;
  if (madeDirs[a]) return true;
  if (baseDirs[a] && !underRemovedDir(a)) return true;
  var list = allFilePaths();
  for (var i = 0; i < list.length; i++) if (list[i].indexOf(a + '/') === 0) return true;
  var dd = Object.keys(madeDirs).concat(Object.keys(baseDirs));
  for (var j = 0; j < dd.length; j++) if (dd[j].indexOf(a + '/') === 0 && !(baseDirs[dd[j]] && underRemovedDir(dd[j]))) return true;
  return false;
}
function readText(a, op) {
  if (isDirPath(a) && !hasFile(a)) throw mkErr('EISDIR', 'illegal operation on a directory', op || 'read', a);
  if (!hasFile(a)) throw mkErr('ENOENT', 'no such file or directory', op || 'open', a);
  if (Object.prototype.hasOwnProperty.call(writes, a)) return writes[a];
  if (skipped[a]) throw mkErr('EIO', 'file is not available in the terminal runner (binary or too large)', op || 'read', a);
  return files[a];
}
function dataToText(d) {
  if (typeof d === 'string') return d;
  if (d instanceof Uint8Array) return utf8Dec.decode(d);
  return String(d);
}
function needParent(a, op) {
  var par = pathMod.dirname(a);
  if (!isDirPath(par)) throw mkErr(hasFile(par) ? 'ENOTDIR' : 'ENOENT', hasFile(par) ? 'not a directory' : 'no such file or directory', op, a);
}
function fsWrite(a, text, append) {
  if (isDirPath(a) && !hasFile(a)) throw mkErr('EISDIR', 'illegal operation on a directory', 'open', a);
  needParent(a, 'open');
  var prev = '';
  if (append && hasFile(a)) prev = readText(a, 'open');
  delete removedFiles[a];
  writes[a] = prev + text;
}
function mkdirP(a) {
  var parts = a.split('/').filter(Boolean);
  var cur = '';
  parts.forEach(function (p) {
    cur += '/' + p;
    if (hasFile(cur)) throw mkErr('ENOTDIR', 'not a directory', 'mkdir', cur);
    if (!isDirPath(cur)) madeDirs[cur] = true;
  });
}
function listDir(a) {
  if (!isDirPath(a)) throw mkErr(hasFile(a) ? 'ENOTDIR' : 'ENOENT', hasFile(a) ? 'not a directory' : 'no such file or directory', 'scandir', a);
  var prefix = a === '/' ? '/' : a + '/';
  var names = {};
  allFilePaths().forEach(function (f) {
    if (f.indexOf(prefix) === 0) {
      var rest = f.slice(prefix.length);
      var i = rest.indexOf('/');
      names[i === -1 ? rest : rest.slice(0, i)] = i === -1 ? 'f' : (names[rest.slice(0, i)] || 'd');
    }
  });
  Object.keys(madeDirs).concat(Object.keys(baseDirs)).forEach(function (d) {
    if (baseDirs[d] && underRemovedDir(d)) return;
    if (d.indexOf(prefix) === 0) {
      var rest = d.slice(prefix.length);
      var i = rest.indexOf('/');
      var nm = i === -1 ? rest : rest.slice(0, i);
      if (nm) names[nm] = 'd';
    }
  });
  return Object.keys(names).sort().map(function (n) { return { name: n, dir: names[n] === 'd' }; });
}
function mkStat(a) {
  var isF = hasFile(a);
  var isD = !isF && isDirPath(a);
  if (!isF && !isD) return null;
  var size = 0;
  if (isF) {
    if (Object.prototype.hasOwnProperty.call(writes, a)) size = utf8Enc.encode(writes[a]).length;
    else if (files[a] !== undefined) size = utf8Enc.encode(files[a]).length;
  }
  var now = new Date();
  return { isFile: function () { return isF; }, isDirectory: function () { return isD; }, isSymbolicLink: function () { return false; }, size: size, mtime: now, atime: now, ctime: now, birthtime: now, mtimeMs: now.getTime(), mode: isD ? 16877 : 33188 };
}
function decodeOpt(text, opt) {
  var enc = typeof opt === 'string' ? opt : (opt && opt.encoding);
  return enc && enc !== 'buffer' ? text : PFBuffer.from(text);
}
var fsSync = {
  readFileSync: function (p, opt) { return decodeOpt(readText(absPath(p), 'open'), opt); },
  writeFileSync: function (p, d) { fsWrite(absPath(p), dataToText(d), false); },
  appendFileSync: function (p, d) { fsWrite(absPath(p), dataToText(d), true); },
  existsSync: function (p) { try { var a = absPath(p); return hasFile(a) || isDirPath(a); } catch (e) { return false; } },
  readdirSync: function (p, opt) {
    var list = listDir(absPath(p));
    if (opt && opt.withFileTypes) return list.map(function (x) { return { name: x.name, isFile: function () { return !x.dir; }, isDirectory: function () { return x.dir; } }; });
    return list.map(function (x) { return x.name; });
  },
  statSync: function (p, o) {
    var a = absPath(p);
    var s = mkStat(a);
    if (!s) { if (o && o.throwIfNoEntry === false) return undefined; throw mkErr('ENOENT', 'no such file or directory', 'stat', a); }
    return s;
  },
  mkdirSync: function (p, o) {
    var a = absPath(p);
    var rec = !!(o && (o === true || o.recursive));
    if (rec) { mkdirP(a); return a; }
    if (hasFile(a) || isDirPath(a)) throw mkErr('EEXIST', 'file already exists', 'mkdir', a);
    needParent(a, 'mkdir');
    madeDirs[a] = true;
  },
  unlinkSync: function (p) {
    var a = absPath(p);
    if (!hasFile(a)) throw mkErr(isDirPath(a) ? 'EISDIR' : 'ENOENT', isDirPath(a) ? 'illegal operation on a directory' : 'no such file or directory', 'unlink', a);
    delete writes[a];
    if (files[a] !== undefined || skipped[a]) removedFiles[a] = true;
  },
  rmSync: function (p, o) {
    var a = absPath(p);
    o = o || {};
    if (hasFile(a)) { fsSync.unlinkSync(a); return; }
    if (isDirPath(a)) {
      if (!o.recursive) throw mkErr('EISDIR', 'illegal operation on a directory', 'rm', a);
      Object.keys(writes).forEach(function (k) { if (k.indexOf(a + '/') === 0) delete writes[k]; });
      Object.keys(madeDirs).forEach(function (k) { if (k === a || k.indexOf(a + '/') === 0) delete madeDirs[k]; });
      removedDirs[a] = true;
      return;
    }
    if (!o.force) throw mkErr('ENOENT', 'no such file or directory', 'rm', a);
  },
  rmdirSync: function (p, o) {
    var a = absPath(p);
    if (!isDirPath(a)) throw mkErr('ENOENT', 'no such file or directory', 'rmdir', a);
    if (listDir(a).length && !(o && o.recursive)) throw mkErr('ENOTEMPTY', 'directory not empty', 'rmdir', a);
    fsSync.rmSync(a, { recursive: true });
  },
  renameSync: function (from, to) {
    var a = absPath(from), b = absPath(to);
    if (hasFile(a)) { var txt = readText(a, 'rename'); fsWrite(b, txt, false); fsSync.unlinkSync(a); return; }
    throw mkErr('ENOENT', 'no such file or directory', 'rename', a);
  },
  copyFileSync: function (from, to) { fsWrite(absPath(to), readText(absPath(from), 'copyfile'), false); },
  accessSync: function (p) { var a = absPath(p); if (!hasFile(a) && !isDirPath(a)) throw mkErr('ENOENT', 'no such file or directory', 'access', a); }
};
var fsMod = {};
var fsPromises = {};
Object.keys(fsSync).forEach(function (k) { fsMod[k] = fsSync[k]; });
['readFile', 'writeFile', 'appendFile', 'readdir', 'stat', 'mkdir', 'unlink', 'rm', 'rmdir', 'rename', 'copyFile', 'access'].forEach(function (n) {
  var sync = fsSync[n + 'Sync'];
  fsPromises[n] = function () {
    var args = arguments;
    return new Promise(function (res, rej) { try { res(sync.apply(null, args)); } catch (e) { rej(e); } });
  };
  fsMod[n] = function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = typeof args[args.length - 1] === 'function' ? args.pop() : function () {};
    var r, err = null;
    try { r = sync.apply(null, args); } catch (e) { err = e; }
    pfSetTimeout(function () { err ? cb(err) : cb(null, r); }, 0);
  };
});
fsMod.exists = function (p, cb) { var r = fsSync.existsSync(p); pfSetTimeout(function () { cb(r); }, 0); };
fsMod.promises = fsPromises;

// ---------- المؤقتات ----------
var timerTable = {};
var timerSeq = 0;
function maybeFinish() {
  if (finished || checkScheduled || pending > 0) return;
  checkScheduled = true;
  origSetTimeout(function () {
    checkScheduled = false;
    if (!finished && pending === 0) finish(proc.exitCode || 0);
  }, 15);
}
function makeTimer(fn, ms, args, repeat) {
  if (typeof fn !== 'function') throw new TypeError('The "callback" argument must be of type function. Received ' + inspect(fn));
  var t = { _id: ++timerSeq, _ref: true, _done: false, _h: 0, _repeat: repeat };
  t.ref = function () { if (!t._ref && !t._done) { t._ref = true; pending++; } return t; };
  t.unref = function () { if (t._ref && !t._done) { t._ref = false; pending--; maybeFinish(); } return t; };
  t.hasRef = function () { return t._ref; };
  t.refresh = function () { return t; };
  t[Symbol.toPrimitive] = function () { return t._id; };
  timerTable[t._id] = t;
  pending++;
  var tick = function () {
    if (finished) return;
    if (!repeat) {
      t._done = true;
      if (t._ref) pending--;
      delete timerTable[t._id];
    }
    try { fn.apply(t, args); } catch (e) { fatal(e); return; }
    maybeFinish();
  };
  t._h = repeat ? origSetInterval(tick, ms) : origSetTimeout(tick, ms);
  return t;
}
function clearTimer(t) {
  if (t === undefined || t === null) return;
  var rec = typeof t === 'object' ? t : timerTable[t];
  if (!rec || rec._done) return;
  rec._done = true;
  if (rec._ref) pending--;
  delete timerTable[rec._id];
  if (rec._repeat) origClearInterval(rec._h); else origClearTimeout(rec._h);
  maybeFinish();
}
function pfSetTimeout(fn, ms) { return makeTimer(fn, ms || 0, Array.prototype.slice.call(arguments, 2), false); }
function pfSetInterval(fn, ms) { return makeTimer(fn, ms || 0, Array.prototype.slice.call(arguments, 2), true); }
function pfSetImmediate(fn) { return makeTimer(fn, 0, Array.prototype.slice.call(arguments, 1), false); }
function clearAllTimers() {
  Object.keys(timerTable).forEach(function (k) {
    var t = timerTable[k];
    if (t._repeat) origClearInterval(t._h); else origClearTimeout(t._h);
  });
  timerTable = {};
}
var origFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
function pfFetch() {
  if (!origFetch) return Promise.reject(new TypeError('fetch is not available'));
  pending++;
  var done = function () { pending--; maybeFinish(); };
  return origFetch.apply(null, arguments).then(function (r) { done(); return r; }, function (e) { done(); throw e; });
}
`;