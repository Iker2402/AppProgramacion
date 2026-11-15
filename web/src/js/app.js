// Interfaz principal de Código Móvil.
import { LANGS, TEMPLATES, EXAMPLES, modeForFile } from './examples.js';
import { SAB_SIZE } from './io.js';

const $ = (sel) => document.querySelector(sel);
const bridge = window.CodigoMovil || null; // interfaz Java de la app Android

// ------------------------------------------------------------ Almacenamiento
const STORE_KEY = 'codigomovil.v1';
let state = loadState();

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.projects && Object.keys(s.projects).length) return s;
  } catch (e) { /* estado nuevo */ }
  const st = { projects: {}, current: null };
  const p = makeProject('Práctica C', 'c', TEMPLATES.c());
  st.projects[p.id] = p;
  st.current = p.id;
  return st;
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
function saveNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { toastStatus('No se pudo guardar: ' + e.message); }
}

function makeProject(name, lang, files, main) {
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  main = main || LANGS[lang].main;
  if (!(main in files)) main = Object.keys(files)[0];
  return { id, name, lang, files, main, open: main };
}

const project = () => state.projects[state.current];

// ------------------------------------------------------------ Editor
CodeMirror.defineSimpleMode('chispa', {
  start: [
    { regex: /\$?"(?:[^\\"]|\\.)*?(?:"|$)/, token: 'string' },
    { regex: /\$?'(?:[^\\']|\\.)*?(?:'|$)/, token: 'string' },
    { regex: /#.*/, token: 'comment' },
    { regex: /(funcion|clase)(\s+)([A-Za-z_À-ɏ][\wÀ-ɏ]*)/, token: ['keyword', null, 'def'] },
    { regex: /(?:si|entonces|sino|fin|mientras|hacer|para|en|desde|hasta|paso|repetir|veces|funcion|retornar|romper|continuar|clase|intentar|capturar|lanzar)\b/, token: 'keyword' },
    { regex: /(?:y|o|no)\b/, token: 'operator' },
    { regex: /(?:verdadero|falso|nulo|yo)\b/, token: 'atom' },
    { regex: /\d+(?:\.\d+)?/, token: 'number' },
    { regex: /(?:mostrar|escribir|leer|leer_numero|numero|entero|texto|longitud|tipo|agregar|insertar|quitar|ordenar|invertir|contiene|indice|claves|valores|rango|aleatorio|redondear|piso|techo|raiz|potencia|abs|maximo|minimo|suma|mayusculas|minusculas|recortar|dividir|unir|reemplazar|subtexto|mapa|filtrar|reducir|esperar|limpiar|color|posicion|tecla|hay_tecla|tiempo|fecha|error|copiar|caracter|codigo|empieza|termina|afirmar)\b/, token: 'builtin' },
    { regex: /[-+\/*=<>!^%]+/, token: 'operator' },
    { regex: /[\{\[\(]/, indent: true },
    { regex: /[\}\]\)]/, dedent: true },
  ],
  meta: { lineComment: '#' },
});

const editor = CodeMirror($('#editor'), {
  theme: 'material-darker',
  lineNumbers: true,
  indentUnit: 4,
  tabSize: 4,
  indentWithTabs: false,
  autoCloseBrackets: true,
  matchBrackets: true,
  styleActiveLine: true,
  lineWrapping: false,
  inputStyle: 'contenteditable',
  extraKeys: { Tab: (cm) => cm.replaceSelection('    '), 'Ctrl-/': 'toggleComment', 'Ctrl-Enter': () => runProject() },
});
let loadingFile = false;
editor.on('change', () => {
  if (loadingFile) return;
  const p = project();
  p.files[p.open] = editor.getValue();
  clearErrorMarks();
  save();
});

const docs = new Map(); // archivo -> CodeMirror.Doc (conserva deshacer por archivo)
function openFile(name) {
  const p = project();
  if (!(name in p.files)) name = p.main in p.files ? p.main : Object.keys(p.files)[0];
  p.open = name;
  const key = p.id + '/' + name;
  let doc = docs.get(key);
  if (!doc || doc.getValue() !== p.files[name]) {
    doc = CodeMirror.Doc(p.files[name] ?? '', modeForFile(name, p.lang));
    docs.set(key, doc);
  }
  loadingFile = true;
  editor.swapDoc(doc);
  loadingFile = false;
  renderTabs();
  save();
}

function renderTabs() {
  const p = project();
  const box = $('#fileTabs');
  box.innerHTML = '';
  const names = Object.keys(p.files).sort((a, b) => (a === p.main ? -1 : b === p.main ? 1 : a.localeCompare(b)));
  for (const n of names) {
    const b = document.createElement('button');
    b.textContent = n;
    if (n === p.main) { const s = document.createElement('span'); s.className = 'main-mark'; s.textContent = '★'; b.append(s); }
    if (n === p.open) b.classList.add('active');
    b.onclick = () => openFile(n);
    box.append(b);
  }
  $('#projName').textContent = p.name;
  $('#projLang').textContent = LANGS[p.lang].name;
  document.querySelector('[data-view=preview]').classList.toggle('hidden', p.lang !== 'web');
}

// Barra de simbolos para el teclado del movil
const SYMBOLS = ['Tab', '{', '}', '(', ')', '[', ']', ';', '"', "'", '<', '>', '=', '+', '-', '*', '/', '%', '&', '|', '!', '#', ':', ',', '.', '_', '\\', '?', '←', '→'];
for (const s of SYMBOLS) {
  const b = document.createElement('button');
  b.textContent = s;
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    if (s === 'Tab') editor.replaceSelection('    ');
    else if (s === '←') editor.execCommand('goCharLeft');
    else if (s === '→') editor.execCommand('goCharRight');
    else editor.replaceSelection(s);
    editor.focus();
  });
  $('#symbols').append(b);
}

// ------------------------------------------------------------ Marcas de error
let errorMarks = [];
function clearErrorMarks() {
  for (const m of errorMarks) m.doc.removeLineClass(m.line, 'background', 'cm-error-line');
  errorMarks = [];
}
function markErrors(text) {
  const p = project();
  const found = [];
  const re = /(?:^|[\s"'/])([\w.\-]+\.(?:c|h|cpp|cc|hpp|py|lua|js|chispa)):(\d+)(?::\d+)?:\s*(?:\x1b\[[0-9;]*m)*\s*(?:fatal )?error/gm;
  let m;
  while ((m = re.exec(text))) found.push([m[1], Number(m[2])]);
  const py = /File "\/home\/pyodide\/proyecto\/([^"]+)", line (\d+)/g;
  while ((m = py.exec(text))) found.push([m[1], Number(m[2])]);
  const lua = /([\w./-]+\.lua):(\d+):/g;
  while ((m = lua.exec(text))) found.push([m[1], Number(m[2])]);
  for (const [file, line] of found) {
    if (!(file in p.files)) continue;
    const doc = docs.get(p.id + '/' + file);
    if (!doc || line < 1 || line > doc.lineCount()) continue;
    doc.addLineClass(line - 1, 'background', 'cm-error-line');
    errorMarks.push({ doc, line: line - 1 });
  }
  return found;
}

// ------------------------------------------------------------ Vistas
function showView(name) {
  for (const b of document.querySelectorAll('.views button')) b.classList.toggle('active', b.dataset.view === name);
  for (const v of document.querySelectorAll('.view')) v.classList.remove('active');
  $('#view' + name[0].toUpperCase() + name.slice(1)).classList.add('active');
  if (name === 'code') setTimeout(() => editor.refresh(), 0);
  if (name === 'output') setTimeout(fitTerminal, 0);
}
for (const b of document.querySelectorAll('.views button')) b.onclick = () => showView(b.dataset.view);

// ------------------------------------------------------------ Terminal
const term = new Terminal({
  convertEol: true,
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  theme: { background: '#000000' },
  scrollback: 5000,
  cursorBlink: true,
});
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open($('#terminal'));
function fitTerminal() {
  try { fitAddon.fit(); } catch (e) { /* oculto */ }
  if (worker) worker.postMessage({ type: 'resize', cols: term.cols, rows: term.rows });
}
window.addEventListener('resize', () => { fitTerminal(); editor.refresh(); });
term.write('\x1b[33mCódigo Móvil\x1b[0m — pulsa ▶ para ejecutar tu programa.\r\n');

let pendingOutput = '';
let outputScheduled = false;
let errText = '';
function termWrite(text, fd) {
  if (fd === 2) errText += text;
  pendingOutput += text;
  if (!outputScheduled) {
    outputScheduled = true;
    requestAnimationFrame(() => { outputScheduled = false; term.write(pendingOutput); pendingOutput = ''; });
  }
}

// ------------------------------------------------------------ Ejecucion
let worker = null;
let sab = null, ctrl = null, sabData = null, sabKeys = null;
let running = false;
let inputMode = 'none';

function createWorker() {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  sab = null;
  try {
    if (typeof SharedArrayBuffer !== 'undefined') {
      const s = new SharedArrayBuffer(SAB_SIZE);
      worker.postMessage({ type: 'init', sab: s });
      sab = s;
      ctrl = new Int32Array(sab, 0, 16);
      sabData = new Uint8Array(sab, 64, 65536);
      sabKeys = new Int32Array(sab, 64 + 65536, 256);
    }
  } catch (e) { sab = null; }
  if (!sab) worker.postMessage({ type: 'init', sab: null });
  worker.onmessage = (ev) => onWorkerMessage(ev.data);
  worker.onerror = (ev) => {
    termWrite('\r\n\x1b[31mError del motor: ' + (ev.message || 'desconocido') + '\x1b[0m\r\n', 2);
    finishRun(1);
  };
}

function onWorkerMessage(m) {
  switch (m.type) {
    case 'out': termWrite(m.text, m.fd); break;
    case 'status': toastStatus(m.text); break;
    case 'input': setInputMode(m.mode); break;
    case 'done': {
      const p = project();
      let filesChanged = false;
      for (const [name, content] of Object.entries(m.changed || {})) {
        if (content === null) { if (name in p.files && name !== p.main) { delete p.files[name]; filesChanged = true; } } else if (p.files[name] !== content) { p.files[name] = content; filesChanged = true; }
      }
      if (filesChanged) { save(); renderTabs(); }
      if (m.errorLine) {
        const doc = docs.get(p.id + '/' + p.main);
        if (doc && m.errorLine <= doc.lineCount()) { doc.addLineClass(m.errorLine - 1, 'background', 'cm-error-line'); errorMarks.push({ doc, line: m.errorLine - 1 }); }
      }
      if (errText) markErrors(errText);
      finishRun(m.code, m.ms);
      break;
    }
    default: break;
  }
}

function setInputMode(mode) {
  inputMode = mode;
  const inp = $('#stdin');
  inp.classList.toggle('waiting', mode !== 'none');
  inp.placeholder = mode === 'line' ? 'Escribe y pulsa Enviar…' : mode === 'key' ? 'Pulsa una tecla…' : (running ? 'Teclas para el programa' : 'Entrada del programa');
  if (mode === 'line' || mode === 'key') {
    showView('output');
    inp.focus();
  }
}

function sendLine(text) {
  if (!running) return;
  term.write(text + '\r\n');
  if (sab) {
    const bytes = new TextEncoder().encode(text).slice(0, 65536);
    sabData.set(bytes);
    Atomics.store(ctrl, 1, bytes.length);
    Atomics.store(ctrl, 0, 1);
    Atomics.notify(ctrl, 0);
  } else if (bridge) {
    bridge.provideInput(text);
  }
  setInputMode('none');
}

function sendKey(code) {
  if (!running) return;
  if (sab) {
    const tail = Atomics.load(ctrl, 3);
    sabKeys[tail % 256] = code;
    Atomics.store(ctrl, 3, tail + 1);
    Atomics.notify(ctrl, 3);
  } else if (bridge) {
    bridge.pushKey(code);
  }
}

const SPECIAL_KEYS = { up: [224, 72], down: [224, 80], left: [224, 75], right: [224, 77], esc: [27], enter: [13], space: [32] };
for (const b of document.querySelectorAll('#keybar button')) {
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.onclick = () => {
    const keys = SPECIAL_KEYS[b.dataset.key];
    if (inputMode === 'line') {
      if (b.dataset.key === 'enter') { sendLine($('#stdin').value); $('#stdin').value = ''; }
      return;
    }
    keys.forEach(sendKey);
  };
}

$('#inputForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const inp = $('#stdin');
  if (inputMode === 'line') { sendLine(inp.value); inp.value = ''; } else if (running) { sendKey(13); }
});
$('#stdin').addEventListener('input', () => {
  const inp = $('#stdin');
  if (inputMode !== 'line' && running && inp.value) {
    for (const ch of inp.value) sendKey(ch.charCodeAt(0));
    inp.value = '';
  }
});
// Teclas desde la propia terminal (teclado fisico o al tocar la terminal)
term.onData((data) => {
  if (!running) return;
  if (inputMode === 'line') {
    const inp = $('#stdin');
    for (const ch of data) {
      if (ch === '\r') { sendLine(inp.value); inp.value = ''; } else if (ch === '\x7f') inp.value = inp.value.slice(0, -1); else if (ch >= ' ') inp.value += ch;
    }
    return;
  }
  const arrows = { '\x1b[A': 'up', '\x1b[B': 'down', '\x1b[D': 'left', '\x1b[C': 'right' };
  if (arrows[data]) { SPECIAL_KEYS[arrows[data]].forEach(sendKey); return; }
  for (const ch of data) sendKey(ch === '\x7f' ? 8 : ch.charCodeAt(0));
});

function toastStatus(text) { $('#status').textContent = text; }

async function runProject() {
  const p = project();
  if (running) return;
  const lang = LANGS[p.lang];
  saveNow();
  clearErrorMarks();
  errText = '';
  if (lang.soon) {
    await alertModal(lang.name + ' todavía no está disponible', `<p>${lang.name} llegará en la próxima versión de la app, funcionando sin internet. Mientras tanto puedes guardar aquí tu código.</p>`);
    return;
  }
  if (p.lang === 'web') { runWeb(); return; }
  if (!worker) createWorker();
  running = true;
  if (bridge && bridge.resetIO) bridge.resetIO();
  if (sab) { Atomics.store(ctrl, 2, 0); Atomics.store(ctrl, 3, 0); }
  $('#btnRun').classList.add('hidden');
  $('#btnStop').classList.remove('hidden');
  $('#keybar').classList.remove('hidden');
  showView('output');
  term.reset();
  fitTerminal();
  toastStatus('Preparando...');
  setInputMode('none');
  worker.postMessage({ type: 'run', lang: p.lang, files: { ...p.files }, main: p.main, cols: term.cols, rows: term.rows });
}

function finishRun(code, ms) {
  running = false;
  setInputMode('none');
  $('#btnRun').classList.remove('hidden');
  $('#btnStop').classList.add('hidden');
  $('#keybar').classList.add('hidden');
  const secs = ms ? ` en ${(ms / 1000).toFixed(1)} s` : '';
  termWrite(`\r\n\x1b[90m--- Programa terminado (código ${code})${secs} ---\x1b[0m\r\n`, 1);
  toastStatus(code === 0 ? 'Terminado' : `Terminado con código ${code}`);
}

function stopRun() {
  if (!running) return;
  if (worker) worker.terminate();
  worker = null;
  if (bridge && bridge.cancelInput) bridge.cancelInput();
  termWrite('\r\n\x1b[31m[Detenido]\x1b[0m', 2);
  finishRun(130);
}

$('#btnRun').onclick = runProject;
$('#btnStop').onclick = stopRun;

// ------------------------------------------------------------ Web (HTML/CSS/JS)
function runWeb() {
  const p = project();
  const files = p.files;
  let html = files[p.main] || files['index.html'] || '<!doctype html><body></body>';
  html = html.replace(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (tag, href) =>
    href in files ? `<style data-file="${href}">\n${files[href]}\n</style>` : tag);
  html = html.replace(/<script\b([^>]*)src=["']([^"']+\.js)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) =>
    src in files ? `<script${a}${b}>\n${files[src].replace(/<\/script/gi, '<\\/script')}\n</script>` : tag);
  const consoleBridge = `<script>(function(){
    function send(level, args){ try { parent.postMessage({__cm:1, level:level, text:[].map.call(args,function(a){ try { return typeof a==='object'? JSON.stringify(a) : String(a);} catch(e){ return String(a);} }).join(' ')}, '*'); } catch(e){} }
    ['log','info','warn','error'].forEach(function(l){ var o=console[l]; console[l]=function(){ send(l, arguments); o.apply(console, arguments); }; });
    window.addEventListener('error', function(e){ send('error', [e.message + ' (línea ' + e.lineno + ')']); });
  })();</script>`;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + consoleBridge) : consoleBridge + html;
  term.reset();
  term.write('\x1b[90mConsola de la página web:\x1b[0m\r\n');
  $('#preview').srcdoc = html;
  showView('preview');
  toastStatus('Vista previa actualizada');
}
window.addEventListener('message', (ev) => {
  const d = ev.data;
  if (d && d.__cm) term.write((d.level === 'error' ? '\x1b[31m' : d.level === 'warn' ? '\x1b[33m' : '') + d.text + '\x1b[0m\r\n');
});

// ------------------------------------------------------------ Modales
function modal(title, bodyHtml, buttons) {
  return new Promise((resolve) => {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    const box = $('#modalButtons');
    box.innerHTML = '';
    const close = (v) => { $('#modal').classList.add('hidden'); resolve(v); };
    for (const [label, value, primary] of buttons) {
      const b = document.createElement('button');
      b.textContent = label;
      if (primary) b.className = 'primary';
      b.onclick = () => close(typeof value === 'function' ? value() : value);
      box.append(b);
    }
    $('#modalBody').querySelectorAll('[data-value]').forEach((el) => { el.onclick = () => close(el.dataset.value); });
    const inp = $('#modalBody').querySelector('input');
    if (inp) {
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(inp.value); });
      setTimeout(() => inp.focus(), 50);
    }
    $('#modal').classList.remove('hidden');
  });
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const alertModal = (t, html) => modal(t, html, [['Vale', true, true]]);
const confirmModal = (t, html) => modal(t, html, [['Cancelar', false], ['Aceptar', true, true]]);
function promptModal(t, value = '', placeholder = '') {
  return modal(t, `<input id="modalInput" value="${esc(value)}" placeholder="${esc(placeholder)}" autocapitalize="off" spellcheck="false">`,
    [['Cancelar', null], ['Aceptar', () => $('#modalInput').value, true]]);
}

// ------------------------------------------------------------ Acciones del menu
const drawer = $('#drawer');
$('#btnMenu').onclick = () => { renderProjectList(); drawer.classList.remove('hidden'); };
$('#btnAddFile').onclick = () => actions.newFile();

function renderProjectList() {
  const box = $('#projectList');
  box.innerHTML = '';
  const list = Object.values(state.projects).sort((a, b) => a.name.localeCompare(b.name));
  for (const p of list) {
    const b = document.createElement('button');
    b.innerHTML = `${esc(p.name)}<span class="lang">${esc(LANGS[p.lang].name)}</span>`;
    if (p.id === state.current) b.classList.add('current');
    b.onclick = () => { switchProject(p.id); drawer.classList.add('hidden'); };
    box.append(b);
  }
}

function switchProject(id) {
  if (running) stopRun();
  state.current = id;
  clearErrorMarks();
  openFile(project().open);
  showView('code');
  save();
}

function addProject(p) {
  state.projects[p.id] = p;
  switchProject(p.id);
}

const validName = (n) => n && /^[\w.\-]+(\/[\w.\-]+)*$/.test(n) && !n.includes('..');

const actions = {
  close() {},
  async newProject() {
    const choices = Object.entries(LANGS).map(([k, l]) =>
      `<button class="choice" data-value="${k}">${esc(l.name)}${l.soon ? '<small>Próximamente: de momento solo se puede editar</small>' : ''}</button>`).join('');
    const lang = await modal('Nuevo proyecto: elige el lenguaje', choices, [['Cancelar', null]]);
    if (!lang) return;
    const name = await promptModal('Nombre del proyecto', 'Proyecto ' + LANGS[lang].name);
    if (!name) return;
    addProject(makeProject(name, lang, TEMPLATES[lang]()));
  },
  async examples() {
    const choices = EXAMPLES.map((e, i) => `<button class="choice" data-value="${i}">${esc(e.name)}</button>`).join('');
    const i = await modal('Ejemplos', choices, [['Cancelar', null]]);
    if (i === null || i === undefined) return;
    const ex = EXAMPLES[Number(i)];
    addProject(makeProject(ex.name.split(':').slice(1).join(':').trim() || ex.name, ex.lang, ex.files(), ex.main));
  },
  async newFile() {
    const p = project();
    const hint = { c: 'funciones.h', cpp: 'utilidades.hpp', python: 'modulo.py', lua: 'modulo.lua', web: 'otra.css', chispa: 'otro.chispa', javascript: 'datos.txt' }[p.lang] || 'archivo.txt';
    const name = await promptModal('Nombre del nuevo archivo', '', hint);
    if (!name) return;
    if (!validName(name)) { await alertModal('Nombre no válido', '<p>Usa letras, números, punto, guion y guion bajo.</p>'); return; }
    if (name in p.files) { openFile(name); return; }
    p.files[name] = headerTemplate(name);
    openFile(name);
  },
  importFile() { $('#fileInput').click(); },
  async exportFile() {
    const p = project();
    const content = p.files[p.open];
    if (bridge && bridge.saveFile) { bridge.saveFile(p.open, content); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    a.download = p.open.split('/').pop();
    a.click();
  },
  async renameFile() {
    const p = project();
    const old = p.open;
    const name = await promptModal('Renombrar archivo', old);
    if (!name || name === old) return;
    if (!validName(name) || name in p.files) { await alertModal('No se puede renombrar', '<p>El nombre no es válido o ya existe.</p>'); return; }
    p.files[name] = p.files[old];
    delete p.files[old];
    if (p.main === old) p.main = name;
    openFile(name);
  },
  async deleteFile() {
    const p = project();
    if (Object.keys(p.files).length <= 1) { await alertModal('No se puede eliminar', '<p>El proyecto necesita al menos un archivo.</p>'); return; }
    if (!(await confirmModal('Eliminar archivo', `<p>¿Eliminar <b>${esc(p.open)}</b>?</p>`))) return;
    delete p.files[p.open];
    if (p.main === p.open) p.main = Object.keys(p.files)[0];
    openFile(p.main);
  },
  setMain() {
    const p = project();
    p.main = p.open;
    renderTabs();
    save();
  },
  async renameProject() {
    const p = project();
    const name = await promptModal('Nombre del proyecto', p.name);
    if (!name) return;
    p.name = name;
    renderTabs();
    save();
  },
  async deleteProject() {
    const p = project();
    if (!(await confirmModal('Eliminar proyecto', `<p>¿Eliminar el proyecto <b>${esc(p.name)}</b> y todos sus archivos?</p>`))) return;
    delete state.projects[p.id];
    if (!Object.keys(state.projects).length) {
      const np = makeProject('Práctica C', 'c', TEMPLATES.c());
      state.projects[np.id] = np;
    }
    switchProject(Object.keys(state.projects)[0]);
  },
  help() {
    alertModal('Cómo funciona', `<div class="help">
      <p>Todo funciona <b>sin internet</b>: los compiladores e intérpretes van dentro de la app.</p>
      <ul>
        <li><b>C y C++</b>: compilador clang real (LLVM). Se compilan todos los <code>.c</code>/<code>.cpp</code> del proyecto, así que tus librerías (<code>llibreriaPropia.h</code> + <code>.c</code>) funcionan igual que en el PC.</li>
        <li><b>Python</b>: CPython completo con su biblioteca estándar.</li>
        <li><b>Lua</b> 5.3, <b>JavaScript</b> y páginas <b>Web</b> (HTML, CSS y JS con vista previa).</li>
        <li><b>Chispa</b>: el lenguaje en español de la app. Mira <i>Ejemplos → Guía de Chispa</i>.</li>
      </ul>
      <p>Cuando el programa pide datos (scanf, input…), escribe abajo en la pestaña <b>Salida</b> y pulsa Enviar. Las flechas y Esc de la barra sirven para <code>getch()</code>.</p>
      <p>Los archivos de texto del proyecto (por ejemplo <code>datos.txt</code>) se pueden abrir con <code>fopen</code>/<code>open</code>, y lo que el programa escriba se guarda en el proyecto.</p>
      <p>La primera ejecución de C/C++ o Python tarda unos segundos mientras se carga el compilador.</p>
    </div>`);
  },
  async compat() {
    const r = await fetch('compat/windows.h');
    const w = await r.text();
    alertModal('windows.h, rlutil.h y conio.h', `<div class="help">
      <p><code>windows.h</code> es parte de Windows y no existe en Android. La app incluye versiones de compatibilidad que traducen lo más usado en clase a la terminal:</p>
      <ul>
        <li><code>Sleep</code>, <code>Beep</code>, <code>system("cls")</code>, <code>system("pause")</code>, <code>system("color 0A")</code></li>
        <li><code>SetConsoleTextAttribute</code>, <code>SetConsoleCursorPosition</code>, <code>GetStdHandle</code>, <code>COORD</code>, ocultar cursor</li>
        <li><code>rlutil.h</code> completo: <code>setColor</code>, <code>cls</code>, <code>locate</code>, <code>gotoxy</code>, <code>getch</code>, <code>getkey</code>, <code>kbhit</code>, <code>msleep</code>…</li>
        <li><code>conio.h</code>: <code>getch</code>, <code>kbhit</code>, <code>clrscr</code>, <code>textcolor</code></li>
      </ul>
      <p>Lo que depende de ventanas gráficas de Windows (CreateWindow, mensajes…) no se puede emular.</p>
      <pre>${esc(w)}</pre></div>`);
  },
};

drawer.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  drawer.classList.add('hidden');
  const fn = actions[a.dataset.action];
  if (fn) fn();
});

function headerTemplate(name) {
  const m = name.match(/^(.*)\.(h|hpp)$/i);
  if (!m) return '';
  const guard = m[1].replace(/\W/g, '_').toUpperCase() + '_H';
  return `#ifndef ${guard}\n#define ${guard}\n\n\n\n#endif\n`;
}

$('#fileInput').addEventListener('change', async (e) => {
  const p = project();
  let last = null;
  for (const f of e.target.files) {
    const name = f.name.replace(/[^\w.\-]/g, '_');
    p.files[name] = await f.text();
    docs.delete(p.id + '/' + name);
    last = name;
  }
  e.target.value = '';
  if (last) openFile(last);
});

// Boton "atras" de Android
window.onAndroidBack = () => {
  if (!$('#modal').classList.contains('hidden')) { $('#modal').classList.add('hidden'); return true; }
  if (!drawer.classList.contains('hidden')) { drawer.classList.add('hidden'); return true; }
  if (!$('#viewCode').classList.contains('active')) { showView('code'); return true; }
  return false;
};
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

// ------------------------------------------------------------ Inicio
openFile(project().open);
renderTabs();
