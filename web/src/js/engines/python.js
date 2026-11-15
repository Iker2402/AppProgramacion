// Python: CPython real (Pyodide, WebAssembly). Incluye toda la biblioteca estandar.
import * as io from '../io.js';

let pyPromise = null;
const WORKDIR = '/home/pyodide/proyecto';

async function loadPython(status) {
  if (!pyPromise) {
    pyPromise = (async () => {
      status('Cargando Python...');
      const { loadPyodide } = await import('../../vendor/pyodide/pyodide.mjs');
      const base = new URL('../../vendor/pyodide/', import.meta.url);
      const indexURL = base.protocol === 'file:' ? decodeURIComponent(base.pathname) : base.href;
      const py = await loadPyodide({ indexURL });
      py.registerJsModule('_codigomovil', {
        sleep: (s) => io.sleep(Number(s) * 1000),
        getch: () => io.getKey(),
        kbhit: () => io.keyAvailable(),
        cols: () => io.term.cols,
        rows: () => io.term.rows,
      });
      py.runPython(`
import time, os, sys, _codigomovil
def _cm_sleep(s):
    sys.stdout.flush()
    _codigomovil.sleep(s)
time.sleep = _cm_sleep
os.makedirs(${JSON.stringify(WORKDIR)}, exist_ok=True)
`);
      return py;
    })();
    pyPromise.catch(() => { pyPromise = null; });
  }
  return pyPromise;
}

export async function run(files, main, status) {
  const py = await loadPython(status);
  status('Ejecutando...');
  const outDec = new TextDecoder();
  const errDec = new TextDecoder();
  py.setStdout({ write: (b) => { io.write(1, outDec.decode(b, { stream: true })); return b.length; }, isatty: true });
  py.setStderr({ write: (b) => { io.write(2, errDec.decode(b, { stream: true })); return b.length; }, isatty: true });
  // Entrada linea a linea: solo se pide una linea nueva cuando Python la necesita.
  let pending = new Uint8Array(0);
  const enc = new TextEncoder();
  py.setStdin({
    read: (buffer) => {
      if (pending.length === 0) {
        const l = io.readLine();
        if (l === null) return 0;
        pending = enc.encode(l + '\n');
      }
      const n = Math.min(buffer.length, pending.length);
      buffer.set(pending.subarray(0, n));
      pending = pending.slice(n);
      return n;
    },
    isatty: true,
  });
  const FS = py.FS;
  // Limpia el directorio de trabajo y escribe los archivos del proyecto.
  for (const name of FS.readdir(WORKDIR)) {
    if (name === '.' || name === '..') continue;
    try { FS.unlink(WORKDIR + '/' + name); } catch (e) { /* subdirectorios: se dejan */ }
  }
  for (const [name, content] of Object.entries(files)) {
    const parts = name.split('/');
    let dir = WORKDIR;
    for (const p of parts.slice(0, -1)) { dir += '/' + p; try { FS.mkdir(dir); } catch (e) { /* existe */ } }
    FS.writeFile(WORKDIR + '/' + name, content);
  }
  py.globals.set('_cm_main', main);
  py.globals.set('_cm_dir', WORKDIR);
  let code = 0;
  try {
    code = py.runPython(`
import sys, os, runpy, traceback
os.chdir(_cm_dir)
if _cm_dir not in sys.path:
    sys.path.insert(0, _cm_dir)
for _n, _m in list(sys.modules.items()):
    if getattr(_m, '__file__', None) and str(_m.__file__).startswith(_cm_dir):
        del sys.modules[_n]
_cm_code = 0
try:
    runpy.run_path(_cm_main, run_name='__main__')
except SystemExit as _e:
    _cm_code = _e.code if isinstance(_e.code, int) else (0 if _e.code is None else 1)
    if not isinstance(_e.code, (int, type(None))):
        print(_e.code, file=sys.stderr)
except KeyboardInterrupt:
    print('\\nInterrumpido', file=sys.stderr)
    _cm_code = 130
except BaseException:
    _t, _v, _tb = sys.exc_info()
    _lines = traceback.format_exception(_t, _v, _tb)
    _lines = [l for l in _lines if 'runpy' not in l and '<exec>' not in l]
    sys.stderr.write(''.join(_lines))
    _cm_code = 1
sys.stdout.flush(); sys.stderr.flush()
_cm_code
`);
  } catch (e) {
    io.write(2, String(e.message || e) + '\n');
    code = 1;
  }
  // Devuelve los archivos de texto que el programa ha creado o modificado.
  const changed = {};
  for (const name of FS.readdir(WORKDIR)) {
    if (name === '.' || name === '..' || name === '__pycache__') continue;
    const path = WORKDIR + '/' + name;
    if (!FS.isFile(FS.stat(path).mode)) continue;
    const content = FS.readFile(path, { encoding: 'utf8' });
    if (files[name] !== content) changed[name] = content;
  }
  for (const name of Object.keys(files)) {
    if (!name.includes('/') && !FS.analyzePath(WORKDIR + '/' + name).exists) changed[name] = null;
  }
  return { code: typeof code === 'number' ? code : 0, changed };
}
