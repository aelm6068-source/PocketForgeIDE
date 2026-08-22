// src/screens/editor/editorHtml.ts

export function getEditorHtml(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #editor {
      height: 100%;
    }
    html, body {
      margin: 0; padding: 0;
      background: #100E17;
      overflow: hidden;
    }
    .cm-editor {
      height: 100%;
    }
    .cm-scroller {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      -webkit-overflow-scrolling: touch;
      overflow-y: auto !important;
      overflow-x: auto !important;
    }
    .cm-gutters {
      background: #100E17 !important;
      border-right: 1px solid #322C47 !important;
    }
    .cm-activeLine {
      background: rgba(107, 92, 246, 0.08) !important;
    }
    .cm-activeLineGutter {
      background: rgba(107, 92, 246, 0.15) !important;
    }
    .cm-foldGutter .cm-gutterElement {
      cursor: pointer;
      color: #948FB0;
      font-size: 13px;
      text-align: center;
      padding: 0 3px;
    }
    .search-match {
      background: rgba(107, 92, 246, 0.35);
    }
    .search-match-active {
      background: rgba(107, 92, 246, 0.7);
    }
  </style>
</head>
<body>
  <div id="editor"></div>

  <script type="module">
    import * as ts from 'https://esm.sh/typescript@5.4.5';
    import {
      EditorView, keymap, lineNumbers, Decoration,
      highlightActiveLine, highlightActiveLineGutter,
    } from 'https://esm.sh/@codemirror/view@6';
    import { EditorState, StateField, StateEffect, Compartment } from 'https://esm.sh/@codemirror/state@6';
    import { defaultKeymap, history, historyKeymap, undo as cmUndo, redo as cmRedo } from 'https://esm.sh/@codemirror/commands@6';
    import { javascript } from 'https://esm.sh/@codemirror/lang-javascript@6';
    import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6';
    import {
      syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching,
      foldGutter, foldKeymap,
    } from 'https://esm.sh/@codemirror/language@6';
    import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from 'https://esm.sh/@codemirror/autocomplete@6';
    import { indentationMarkers } from 'https://esm.sh/@replit/codemirror-indentation-markers@6';

    let view = null;
    let keyboardLocked = true;
    let searchMatches = [];
    let searchIndex = -1;
    let isWrapped = false;
    let currentLanguage = 'tsx'; // ts | tsx | js | jsx
    let diagnosticsTimer = null;

    const wrapCompartment = new Compartment();

    function post(type, payload) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
    }

    const setMatches = StateEffect.define();
    const matchesField = StateField.define({
      create() { return Decoration.none; },
      update(deco, tr) {
        for (const effect of tr.effects) {
          if (effect.is(setMatches)) return effect.value;
        }
        return deco.map(tr.changes);
      },
      provide: (f) => EditorView.decorations.from(f),
    });

    function buildDecorations(matches, activeIdx) {
      const items = matches.map((m, i) =>
        Decoration.mark({ class: i === activeIdx ? 'search-match-active' : 'search-match' }).range(m.from, m.to)
      );
      items.sort((a, b) => a.from - b.from);
      return Decoration.set(items);
    }

    // فحص الكود الحقيقي: كل لغة بقواعدها المناسبة (TypeScript أو JavaScript)
    function runDiagnostics(content) {
      post('diagnosticsChecking', null);
      if (diagnosticsTimer) clearTimeout(diagnosticsTimer);
      diagnosticsTimer = setTimeout(() => {
        try {
          const isJsx = currentLanguage === 'tsx' || currentLanguage === 'jsx';

          const result = ts.transpileModule(content, {
            reportDiagnostics: true,
            compilerOptions: {
              jsx: isJsx ? ts.JsxEmit.React : undefined,
              target: ts.ScriptTarget.ESNext,
              module: ts.ModuleKind.ESNext,
              allowJs: true,
              checkJs: false,
            },
          });

          const errors = [];
          const warnings = [];

          (result.diagnostics || []).forEach((d, i) => {
            const message = ts.flattenDiagnosticMessageText(d.messageText, '\\n');
            let line = 1;
            if (d.file && typeof d.start === 'number') {
              const pos = d.file.getLineAndCharacterOfPosition(d.start);
              line = pos.line + 1;
            }
            const item = { id: 'diag-' + i, line, message };
            if (d.category === 1) errors.push(item);
            else warnings.push(item);
          });

          post('diagnostics', { errors, warnings });
        } catch (e) {
          post('diagnostics', { errors: [], warnings: [] });
        }
      }, 500);
    }

    function createEditor(initialContent, language) {
      currentLanguage = language;
      const isTsx = language === 'tsx' || language === 'jsx';
      const isTypescript = language === 'ts' || language === 'tsx';

      const state = EditorState.create({
        doc: initialContent,
        extensions: [
          lineNumbers(),
          foldGutter(),
          history(),
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          autocompletion(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          javascript({ jsx: isTsx, typescript: isTypescript }),
          indentationMarkers({ highlightActiveBlock: true }),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          oneDark,
          matchesField,
          wrapCompartment.of([]),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, ...foldKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const text = update.state.doc.toString();
              post('contentChanged', text);
              clearSearch();
              runDiagnostics(text);
            }
          }),
          EditorView.theme({ '&': { height: '100%' } }),
        ],
      });

      view = new EditorView({ state, parent: document.getElementById('editor') });
      applyKeyboardLock();
      post('ready', null);
      runDiagnostics(initialContent);
    }

    function applyKeyboardLock() {
      if (!view) return;
      if (keyboardLocked) {
        view.contentDOM.setAttribute('inputmode', 'none');
      } else {
        view.contentDOM.removeAttribute('inputmode');
      }
      view.contentDOM.setAttribute('autocorrect', 'off');
      view.contentDOM.setAttribute('autocapitalize', 'off');
      view.contentDOM.setAttribute('spellcheck', 'false');
    }

    function runSearch(query, caseSensitive) {
      if (!view || !query) {
        clearSearch();
        return;
      }
      const text = view.state.doc.toString();
      const haystack = caseSensitive ? text : text.toLowerCase();
      const needle = caseSensitive ? query : query.toLowerCase();
      searchMatches = [];
      let from = 0;
      while (true) {
        const idx = haystack.indexOf(needle, from);
        if (idx === -1) break;
        searchMatches.push({ from: idx, to: idx + needle.length });
        from = idx + needle.length;
      }
      searchIndex = searchMatches.length > 0 ? 0 : -1;
      applySearchHighlight();
      jumpToActiveMatch();
      post('searchResult', { total: searchMatches.length, index: searchIndex + 1 });
    }

    function applySearchHighlight() {
      if (!view) return;
      view.dispatch({ effects: setMatches.of(buildDecorations(searchMatches, searchIndex)) });
    }

    function jumpToActiveMatch() {
      if (!view || searchIndex === -1) return;
      const m = searchMatches[searchIndex];
      view.dispatch({
        selection: { anchor: m.from, head: m.to },
        effects: EditorView.scrollIntoView(m.from, { y: 'center' }),
      });
    }

    function searchStep(direction) {
      if (searchMatches.length === 0) return;
      searchIndex = (searchIndex + direction + searchMatches.length) % searchMatches.length;
      applySearchHighlight();
      jumpToActiveMatch();
      post('searchResult', { total: searchMatches.length, index: searchIndex + 1 });
    }

    function clearSearch() {
      searchMatches = [];
      searchIndex = -1;
      if (view) view.dispatch({ effects: setMatches.of(Decoration.none) });
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    function handleMessage(event) {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'init') {
          createEditor(msg.payload.content, msg.payload.language);
        }

        if (msg.type === 'insertText' && view) {
          const pos = view.state.selection.main.head;
          view.dispatch({
            changes: { from: pos, to: pos, insert: msg.payload },
            selection: { anchor: pos + msg.payload.length },
          });
          view.focus();
        }

        if (msg.type === 'setContent' && view) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: msg.payload },
          });
        }

        if (msg.type === 'setKeyboardLock') {
          keyboardLocked = !!msg.payload;
          applyKeyboardLock();
          if (!keyboardLocked && view) view.focus();
        }

        if (msg.type === 'command' && view) {
          if (msg.payload === 'undo') cmUndo(view);
          else if (msg.payload === 'redo') cmRedo(view);
          else if (msg.payload === 'selectAll') {
            view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
          }
          view.focus();
        }

        if (msg.type === 'toggleWrap' && view) {
          isWrapped = !isWrapped;
          view.dispatch({
            effects: wrapCompartment.reconfigure(isWrapped ? [EditorView.lineWrapping] : []),
          });
          post('wrapState', isWrapped);
        }

        if (msg.type === 'keyboardCommand' && view) {
          const { state, dispatch } = view;
          const pos = state.selection.main.head;
          if (msg.payload === 'backspace') {
            if (pos > 0) dispatch({ changes: { from: pos - 1, to: pos, insert: '' } });
          } else if (msg.payload === 'newline') {
            dispatch({ changes: { from: pos, to: pos, insert: '\\n' }, selection: { anchor: pos + 1 } });
          } else if (msg.payload === 'tab') {
            dispatch({ changes: { from: pos, to: pos, insert: '  ' }, selection: { anchor: pos + 2 } });
          } else if (msg.payload === 'arrowLeft') {
            dispatch({ selection: { anchor: Math.max(0, pos - 1) } });
          } else if (msg.payload === 'arrowRight') {
            dispatch({ selection: { anchor: Math.min(state.doc.length, pos + 1) } });
          }
          view.focus();
        }

        if (msg.type === 'search') {
          runSearch(msg.payload.query, !!msg.payload.caseSensitive);
        }
        if (msg.type === 'searchNext') searchStep(1);
        if (msg.type === 'searchPrev') searchStep(-1);
        if (msg.type === 'clearSearch') {
          clearSearch();
          post('searchResult', { total: 0, index: 0 });
        }
        if (msg.type === 'gotoLine' && view) {
          const lineNum = Math.max(1, Math.min(view.state.doc.lines, msg.payload));
          const line = view.state.doc.line(lineNum);
          view.dispatch({
            selection: { anchor: line.from },
            effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
          });
          view.focus();
        }
      } catch (e) {
        post('error', String(e));
      }
    }
  </script>
</body>
</html>
`;
}