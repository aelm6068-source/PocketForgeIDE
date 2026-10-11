// src/components/terminal/terminalHtml.ts
// صفحة HTML بتتعرض جوه WebView لمخرجات الطرفية. السبب: النص جوه صفحة ويب بيتحدد
// ويتنسخ بالسحب زي المتصفح بالظبط (عكس Text العادي في React Native على أندرويد).
// ⚠️ كل النصوص بتتحط بـ textContent فقط (مش innerHTML) - عشان أي محتوى ملف يتعرض
// بالأمر cat مايتنفذش كـ HTML أو سكربت.
//
// الواجهة اللي التطبيق بيكلمها (عن طريق injectJavaScript):
//   window.term.add([{k:'cmd'|'out'|'err'|'info', t:'نص', p:'/src $'}])  -> يضيف أسطر
//   window.term.reset([...])                                              -> يمسح ويرسم من جديد
//   window.term.clear()                                                   -> يمسح كله
// وبيبعت للتطبيق رسالة 'ready' أول ما الصفحة تجهز.
export const TERMINAL_HTML = [
  '<!doctype html><html><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">',
  '<style>',
  'html,body{margin:0;padding:0;height:100%;background:#0B0A10;color:#E7E4F5;}',
  'body{overflow-y:auto;overflow-x:hidden;-webkit-text-size-adjust:100%;}',
  '#out{padding:10px 12px 16px;font-family:"JetBrains Mono","Roboto Mono",Menlo,"Courier New",monospace;font-size:13px;line-height:1.55;}',
  '.l{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;tab-size:4;',
  'user-select:text;-webkit-user-select:text;min-height:1.55em;}',
  '.out{unicode-bidi:plaintext;text-align:start;}',
  '.err{color:#F2607A;unicode-bidi:plaintext;text-align:start;}',
  '.info{color:#948FB0;unicode-bidi:plaintext;text-align:start;}',
  '.cmd{direction:ltr;text-align:left;color:#F1EFFA;font-weight:600;margin-top:6px;}',
  '.p{color:#4ADE9C;margin-right:8px;font-weight:700;}',
  '::selection{background:rgba(124,106,242,0.55);}',
  '</style></head><body><div id="out"></div><script>',
  '(function(){',
  'var out=document.getElementById("out");',
  'var MAX_ROWS=3000;',
  'function atBottom(){return (document.body.scrollHeight-window.innerHeight-window.scrollY)<60;}',
  'function toBottom(){window.scrollTo(0,document.body.scrollHeight);}',
  'function row(item){',
  '  var d=document.createElement("div");',
  '  var k=item.k||"out";',
  '  d.className="l "+k;',
  '  if(k==="cmd"){',
  '    var p=document.createElement("span");p.className="p";p.textContent=item.p||"$";d.appendChild(p);',
  '    var b=document.createElement("bdi");b.textContent=item.t==null?"":String(item.t);d.appendChild(b);',
  '  }else{',
  '    d.setAttribute("dir","auto");',
  '    d.textContent=item.t==null?"":String(item.t);',
  '  }',
  '  return d;',
  '}',
  'window.term={',
  '  add:function(items){',
  '    var stick=atBottom();',
  '    var frag=document.createDocumentFragment();',
  '    for(var i=0;i<items.length;i++){frag.appendChild(row(items[i]));}',
  '    out.appendChild(frag);',
  '    while(out.childNodes.length>MAX_ROWS){out.removeChild(out.firstChild);}',
  '    if(stick){toBottom();}',
  '  },',
  '  reset:function(items){out.textContent="";window.term.add(items||[]);toBottom();},',
  '  clear:function(){out.textContent="";}',
  '};',
  'function ready(){',
  '  if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage("ready");}',
  '}',
  'if(document.readyState==="complete"){ready();}else{window.addEventListener("load",ready);}',
  '})();',
  '</script></body></html>',
].join('\n');