// مُشغّل الجافاسكربت (الجزء 1 من 3): المخرجات وطباعة القيم (inspect) والكونسول
// نص JavaScript خام بيتجمّع مع الأجزاء الباقية في jsRunnerHtml.ts
export const RUNNER_PART_1 = String.raw`
// ===== الجزء A: المخرجات، الطباعة (inspect)، الكونسول، path، Buffer =====
var RN = window.ReactNativeWebView;
var BT = String.fromCharCode(96);
var MAX_MSGS = 20000;
var msgCount = 0;
var truncated = false;
var userFiles = {};
var WRAP_PREFIX = '(function (exports, require, module, __filename, __dirname) { ';
var WRAP_LEN = WRAP_PREFIX.length;

function rawPost(o) {
  try { RN.postMessage(JSON.stringify(o)); } catch (e) {}
}
function post(o) {
  if (o.t === 'out' || o.t === 'err') {
    if (msgCount >= MAX_MSGS) {
      if (!truncated) { truncated = true; rawPost({ t: 'diag', code: 'truncated' }); }
      return;
    }
    msgCount++;
    if (o.s.length > 100000) o.s = o.s.slice(0, 100000) + '\n';
  }
  rawPost(o);
}
var bufs = { out: '', err: '' };
function writeStream(kind, s) {
  var b = bufs[kind] + String(s);
  var i = b.lastIndexOf('\n');
  if (i === -1) { bufs[kind] = b; return; }
  bufs[kind] = b.slice(i + 1);
  post({ t: kind, s: b.slice(0, i + 1) });
}
function flushStreams() {
  ['out', 'err'].forEach(function (k) {
    if (bufs[k]) { post({ t: k, s: bufs[k] + '\n' }); bufs[k] = ''; }
  });
}

// ---------- inspect ----------
function quoteStr(s) {
  var q = "'";
  if (s.indexOf("'") !== -1) q = s.indexOf('"') === -1 ? '"' : (s.indexOf(BT) === -1 ? BT : "'");
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === q || c === '\\') out += '\\' + c;
    else if (c === '\n') out += '\\n';
    else if (c === '\t') out += '\\t';
    else if (c === '\r') out += '\\r';
    else out += c;
  }
  return q + out + q;
}
function isIdent(k) { return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k); }
function tagOf(v) { return Object.prototype.toString.call(v).slice(8, -1); }
function ctorName(v) {
  try {
    var p = Object.getPrototypeOf(v);
    if (p === null) return null;
    var c = p.constructor;
    return c && c.name ? c.name : '';
  } catch (e) { return ''; }
}
function fmtFunction(f) {
  var src = '';
  try { src = Function.prototype.toString.call(f); } catch (e) {}
  if (/^class[\s{]/.test(src)) return '[class ' + (f.name || '(anonymous)') + ']';
  return f.name ? '[Function: ' + f.name + ']' : '[Function (anonymous)]';
}
function fmtPrim(v, top) {
  switch (typeof v) {
    case 'string': return top ? v : quoteStr(v);
    case 'number': return (v === 0 && 1 / v === -Infinity) ? '-0' : String(v);
    case 'bigint': return String(v) + 'n';
    case 'boolean': return String(v);
    case 'undefined': return 'undefined';
    case 'symbol': return v.toString();
    case 'function': return fmtFunction(v);
  }
  return String(v);
}
function cleanStack(e) {
  var stack = e && e.stack ? String(e.stack) : '';
  var head = (e && e.name ? e.name : 'Error') + (e && e.message ? ': ' + e.message : '');
  if (!stack) return head;
  var lines = stack.split('\n');
  var out = [];
  var i = 0;
  while (i < lines.length && !/^\s+at /.test(lines[i])) { out.push(lines[i]); i++; }
  for (; i < lines.length; i++) {
    var ln = lines[i];
    var keep = false;
    for (var f in userFiles) { if (ln.indexOf(f + ':') !== -1) { keep = true; break; } }
    if (keep) {
      ln = ln.replace(/\(eval at [^)]*\), /g, '').replace('Object.eval', 'Object.<anonymous>');
      ln = ln.replace(/:(\d+):(\d+)(\)?)$/, function (m, l, c, p) {
        return ':' + l + ':' + (l === '1' ? Math.max(1, Number(c) - WRAP_LEN) : c) + (p || '');
      });
      out.push(ln);
    }
  }
  if (e && e.pfFile && e.pfLocation) out.unshift(e.pfLocation);
  return out.join('\n');
}
function fmtError(e) {
  var s = cleanStack(e);
  var extra = [];
  try {
    Object.keys(e).forEach(function (k) {
      if (k === 'pfFile' || k === 'pfLocation' || k === 'pfName' || k === 'message' || k === 'stack') return;
      extra.push(k + ': ' + fmtValue(e[k], { depth: 1, seen: [] }, 1, true));
    });
  } catch (x) {}
  return extra.length ? s + ' {\n  ' + extra.join(',\n  ') + '\n}' : s;
}
function wrapItems(open, close, items, level, prefix) {
  if (!items.length) return prefix + open + close;
  var total = prefix.length + 2;
  var multi = false;
  for (var i = 0; i < items.length; i++) {
    total += items[i].length + 2;
    if (items[i].indexOf('\n') !== -1) multi = true;
  }
  if (!multi && total + level * 2 <= 72) return prefix + open + ' ' + items.join(', ') + ' ' + close;
  var pad = '';
  for (var j = 0; j < level + 1; j++) pad += '  ';
  var padEnd = pad.slice(2);
  return prefix + open + '\n' + pad + items.join(',\n' + pad) + '\n' + padEnd + close;
}
function fmtValue(v, ctx, level, nested) {
  if (v === null) return 'null';
  var type = typeof v;
  if (type !== 'object' && type !== 'function') return fmtPrim(v, !nested);
  if (type === 'function') {
    var keys0 = Object.keys(v);
    if (!keys0.length) return fmtFunction(v);
  }
  if (ctx.seen.indexOf(v) !== -1) return '[Circular]';
  if (v instanceof Error) return fmtError(v);
  if (v instanceof Date) return isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString();
  if (v instanceof RegExp) return String(v);
  if (typeof v.then === 'function' && tagOf(v) === 'Promise') return 'Promise {}';
  var name = ctorName(v);
  var isArr = Array.isArray(v);
  var isMap = v instanceof Map;
  var isSet = v instanceof Set;
  var isTyped = ArrayBuffer.isView(v) && !(v instanceof DataView);
  if (isTyped && name === 'PFBuffer') {
    var hex = [];
    for (var b = 0; b < Math.min(v.length, 50); b++) hex.push((v[b] < 16 ? '0' : '') + v[b].toString(16));
    return '<Buffer' + (hex.length ? ' ' + hex.join(' ') : '') + (v.length > 50 ? ' ... ' + (v.length - 50) + ' more bytes' : '') + '>';
  }
  if (level > ctx.depth) return isArr ? '[Array]' : '[' + (name || 'Object') + ']';
  ctx.seen.push(v);
  var items = [];
  var open = '{', close = '}', prefix = '';
  try {
    if (isArr || isTyped) {
      open = '['; close = ']';
      if (isTyped) prefix = name + '(' + v.length + ') ';
      else if (name && name !== 'Array') prefix = name + '(' + v.length + ') ';
      var n = Math.min(v.length, 100);
      var holes = 0;
      for (var i = 0; i < n; i++) {
        if (isArr && !(i in v)) { holes++; continue; }
        if (holes) { items.push('<' + holes + ' empty item' + (holes > 1 ? 's' : '') + '>'); holes = 0; }
        items.push(fmtValue(v[i], ctx, level + 1, true));
      }
      if (holes) items.push('<' + holes + ' empty item' + (holes > 1 ? 's' : '') + '>');
      if (v.length > 100) items.push('... ' + (v.length - 100) + ' more item' + (v.length - 100 > 1 ? 's' : ''));
      if (isArr) {
        Object.keys(v).forEach(function (k) {
          if (!/^\d+$/.test(k)) items.push((isIdent(k) ? k : quoteStr(k)) + ': ' + fmtValue(v[k], ctx, level + 1, true));
        });
      }
    } else if (isMap) {
      prefix = 'Map(' + v.size + ') ';
      v.forEach(function (val, key) {
        items.push(fmtValue(key, ctx, level + 1, true) + ' => ' + fmtValue(val, ctx, level + 1, true));
      });
    } else if (isSet) {
      prefix = 'Set(' + v.size + ') ';
      v.forEach(function (val) { items.push(fmtValue(val, ctx, level + 1, true)); });
    } else {
      if (name === null) prefix = '[Object: null prototype] ';
      else if (name && name !== 'Object') prefix = name + ' ';
      if (type === 'function') prefix = fmtFunction(v) + ' ';
      var tag = tagOf(v);
      if (tag !== 'Object' && tag !== 'Function' && name === 'Object') prefix = '[' + tag + '] ';
      Object.keys(v).forEach(function (k) {
        var val;
        try { val = fmtValue(v[k], ctx, level + 1, true); } catch (e) { val = '[Getter threw]'; }
        items.push((isIdent(k) ? k : quoteStr(k)) + ': ' + val);
      });
    }
  } finally {
    ctx.seen.pop();
  }
  return wrapItems(open, close, items, level, prefix);
}
function inspect(v, opts) {
  opts = opts || {};
  var depth = opts.depth === undefined ? 2 : (opts.depth === null ? Infinity : opts.depth);
  return fmtValue(v, { depth: depth, seen: [] }, 0, true);
}
function inspectNested(v) { return fmtValue(v, { depth: 2, seen: [] }, 0, true); }
function format() {
  var args = Array.prototype.slice.call(arguments);
  var first = args[0];
  var out = '';
  var idx = 1;
  if (typeof first === 'string') {
    out = first.replace(/%[sdifjoOc%]/g, function (m) {
      if (m === '%%') return '%';
      if (idx >= args.length) return m;
      var a = args[idx++];
      switch (m) {
        case '%s': return typeof a === 'string' ? a : (typeof a === 'object' && a !== null ? inspectNested(a) : fmtPrim(a, true));
        case '%d': return typeof a === 'bigint' ? a + 'n' : String(Number(a));
        case '%i': return String(parseInt(a, 10));
        case '%f': return String(parseFloat(a));
        case '%j': try { return JSON.stringify(a); } catch (e) { return '[Circular]'; }
        case '%o': case '%O': return inspectNested(a);
        case '%c': return '';
      }
      return m;
    });
  } else {
    out = typeof first === 'object' && first !== null || typeof first === 'function' ? inspectNested(first) : fmtPrim(first, true);
    if (args.length === 0) out = '';
  }
  for (; idx < args.length; idx++) {
    var a2 = args[idx];
    out += ' ' + (typeof a2 === 'string' ? a2 : inspectNested(a2));
  }
  return out;
}

// ---------- console ----------
var groupIndent = '';
function logTo(kind, args) {
  var s = format.apply(null, args);
  if (groupIndent) s = s.split('\n').map(function (l) { return groupIndent + l; }).join('\n');
  writeStream(kind, s + '\n');
}
var counts = {};
var timersLabel = {};
function tableText(data) {
  var rows = [];
  var cols = [];
  var hasValues = false;
  var isMapLike = Array.isArray(data);
  var keys = Object.keys(data);
  keys.forEach(function (k) {
    var row = data[k];
    var cells = {};
    if (row !== null && typeof row === 'object') {
      Object.keys(row).forEach(function (c) {
        if (cols.indexOf(c) === -1) cols.push(c);
        cells[c] = inspectNested(row[c]);
      });
    } else { hasValues = true; cells.__v = inspectNested(row); }
    rows.push({ k: k, cells: cells });
  });
  var head = [isMapLike ? '(index)' : '(index)'].concat(cols);
  if (hasValues) head.push('Values');
  var table = rows.map(function (r) {
    var line = [r.k];
    cols.forEach(function (c) { line.push(r.cells[c] === undefined ? '' : r.cells[c]); });
    if (hasValues) line.push(r.cells.__v === undefined ? '' : r.cells.__v);
    return line;
  });
  var widths = head.map(function (h, i) {
    var w = h.length;
    table.forEach(function (r) { w = Math.max(w, r[i].length); });
    return w + 2;
  });
  function pad(s, w) {
    var left = Math.floor((w - s.length) / 2);
    return new Array(left + 1).join(' ') + s + new Array(w - s.length - left + 1).join(' ');
  }
  function line(l, m, r) { return l + widths.map(function (w) { return new Array(w + 1).join('─'); }).join(m) + r; }
  var out = [line('┌', '┬', '┐'), '│' + head.map(function (h, i) { return pad(h, widths[i]); }).join('│') + '│', line('├', '┼', '┤')];
  table.forEach(function (r) { out.push('│' + r.map(function (c, i) { return pad(c, widths[i]); }).join('│') + '│'); });
  out.push(line('└', '┴', '┘'));
  return out.join('\n');
}
var pfConsole = {
  log: function () { logTo('out', arguments); },
  info: function () { logTo('out', arguments); },
  debug: function () { logTo('out', arguments); },
  warn: function () { logTo('err', arguments); },
  error: function () { logTo('err', arguments); },
  trace: function () {
    var e = new Error(format.apply(null, arguments));
    e.name = 'Trace';
    logTo('err', [cleanStack(e)]);
  },
  dir: function (v, o) { writeStream('out', groupIndent + inspect(v, o && { depth: o.depth }) + '\n'); },
  assert: function (cond) {
    if (!cond) {
      var rest = Array.prototype.slice.call(arguments, 1);
      logTo('err', ['Assertion failed' + (rest.length ? ': ' + format.apply(null, rest) : '')]);
    }
  },
  group: function () { if (arguments.length) logTo('out', arguments); groupIndent += '  '; },
  groupEnd: function () { groupIndent = groupIndent.slice(2); },
  count: function (l) { l = l === undefined ? 'default' : String(l); counts[l] = (counts[l] || 0) + 1; logTo('out', [l + ': ' + counts[l]]); },
  countReset: function (l) { counts[l === undefined ? 'default' : String(l)] = 0; },
  time: function (l) { timersLabel[l === undefined ? 'default' : String(l)] = performance.now(); },
  timeEnd: function (l) {
    l = l === undefined ? 'default' : String(l);
    if (timersLabel[l] === undefined) return;
    logTo('out', [l + ': ' + (performance.now() - timersLabel[l]).toFixed(3) + 'ms']);
    delete timersLabel[l];
  },
  timeLog: function (l) {
    l = l === undefined ? 'default' : String(l);
    if (timersLabel[l] === undefined) return;
    logTo('out', [l + ': ' + (performance.now() - timersLabel[l]).toFixed(3) + 'ms']);
  },
  table: function (d) {
    if (d === null || typeof d !== 'object') { logTo('out', [d]); return; }
    writeStream('out', tableText(d) + '\n');
  }
};
pfConsole.groupCollapsed = pfConsole.group;
`;