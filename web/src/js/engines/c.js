// C y C++: compilador clang real (LLVM compilado a WebAssembly) dentro de la app.
// El programa resultante (wasm32-wasip1) se ejecuta con nuestro WASI (../wasi.js).
import { Wasi } from '../wasi.js';
import * as io from '../io.js';

let clangPromise = null;
let compatFiles = null;

const COMPAT = ['__compat.h', 'compat.c', 'compat_cxx.cpp', 'windows.h', 'rlutil.h', 'conio.h'];
const C_EXT = /\.c$/i;
const CPP_EXT = /\.(c|cc|cpp|cxx|c\+\+)$/i;
const HEADER_EXT = /\.(h|hh|hpp|hxx|inc)$/i;

async function loadClang(status) {
  if (!clangPromise) {
    clangPromise = (async () => {
      status('Cargando compilador C/C++ (la primera vez tarda un poco)...');
      const mod = await import('../../vendor/clang/bundle.js');
      // Descarga y prepara los recursos (cabeceras y bibliotecas estandar) una sola vez.
      await mod.runClang(null, {}, {
        fetchProgress: ({ doneLength, totalLength }) => {
          if (totalLength) status(`Cargando compilador C/C++... ${Math.round(100 * doneLength / totalLength)}%`);
        },
      });
      return mod.runClang;
    })();
    clangPromise.catch(() => { clangPromise = null; });
  }
  return clangPromise;
}

async function loadCompat() {
  if (!compatFiles) {
    compatFiles = {};
    for (const name of COMPAT) {
      compatFiles[name] = await io.fetchText(new URL('../../compat/' + name, import.meta.url));
    }
  }
  return compatFiles;
}

export function compileArgs(lang, sources) {
  const cxx = lang === 'cpp';
  return [
    cxx ? 'clang++' : 'clang',
    '-O1',
    '-fcolor-diagnostics',
    '-Wno-deprecated',
    '-Icompat',
    '-include', 'compat/__compat.h',
    '-D_WASI_EMULATED_PROCESS_CLOCKS',
    '-D_WASI_EMULATED_SIGNAL',
    '-D_WASI_EMULATED_GETPID',
    '-D_WASI_EMULATED_MMAN',
    '-x', 'c', 'compat/compat.c', '-x', 'none',
    ...(cxx ? ['compat/compat_cxx.cpp'] : []),
    ...sources,
    '-lwasi-emulated-process-clocks',
    '-lwasi-emulated-signal',
    '-lwasi-emulated-getpid',
    '-lwasi-emulated-mman',
    '-Wl,-z,stack-size=8388608',
    '-o', 'programa.wasm',
  ];
}

export function splitFiles(lang, files) {
  const srcRe = lang === 'cpp' ? CPP_EXT : C_EXT;
  const sources = [];
  const compileFiles = {};
  const dataFiles = {};
  for (const [name, content] of Object.entries(files)) {
    if (srcRe.test(name)) { sources.push(name); compileFiles[name] = content; }
    else if (HEADER_EXT.test(name)) compileFiles[name] = content;
    else dataFiles[name] = content;
  }
  return { sources, compileFiles, dataFiles };
}

// Pone los archivos en arbol de directorios para el sistema virtual de clang.
function toTree(flat) {
  const root = {};
  for (const [path, content] of Object.entries(flat)) {
    const parts = path.split('/').filter(Boolean);
    let dir = root;
    for (const p of parts.slice(0, -1)) dir = dir[p] = dir[p] || {};
    dir[parts[parts.length - 1]] = content;
  }
  return root;
}

export async function run(lang, files, status) {
  const runClang = await loadClang(status);
  const compat = await loadCompat();
  const { sources, compileFiles, dataFiles } = splitFiles(lang, files);
  if (sources.length === 0) {
    io.write(2, 'No hay ningun archivo ' + (lang === 'cpp' ? '.cpp' : '.c') + ' en el proyecto.\n');
    return { code: 1 };
  }
  status('Compilando...');
  const tree = toTree(compileFiles);
  tree.compat = { ...compat };
  const errDec = new TextDecoder();
  const toErr = (bytes) => { if (bytes) io.write(2, errDec.decode(bytes, { stream: true })); };
  let out;
  const t0 = Date.now();
  try {
    out = await runClang(compileArgs(lang, sources), tree, {
      stdout: toErr, stderr: toErr, decodeASCII: false,
    });
  } catch (e) {
    io.write(2, '\n\x1b[31mError de compilacion.\x1b[0m\n');
    return { code: 1 };
  }
  const wasm = out['programa.wasm'];
  if (!wasm) {
    io.write(2, 'El compilador no genero el programa.\n');
    return { code: 1 };
  }
  status(`Compilado en ${((Date.now() - t0) / 1000).toFixed(1)} s. Ejecutando...`);
  io.flush();
  const module = await WebAssembly.compile(wasm);
  const enc = new TextEncoder();
  const fsFiles = {};
  for (const [n, c] of Object.entries(dataFiles)) fsFiles[n] = typeof c === 'string' ? enc.encode(c) : c;
  const decs = { 1: new TextDecoder(), 2: new TextDecoder() };
  const wasi = new Wasi({
    args: ['programa'],
    env: { TERM: 'xterm-256color', LANG: 'es_ES.UTF-8' },
    files: fsFiles,
    io: {
      write: (fd, bytes) => io.write(fd, decs[fd].decode(bytes, { stream: true })),
      readStdin: () => io.readLine(),
      getch: () => io.getKey(),
      kbhit: () => io.keyAvailable(),
      sleep: (ms) => io.sleep(ms),
      get cols() { return io.term.cols; },
      get rows() { return io.term.rows; },
    },
  });
  let code;
  try {
    code = wasi.start(module);
  } catch (e) {
    io.write(2, '\n\x1b[31mEl programa ha fallado: ' + describeTrap(e) + '\x1b[0m\n');
    code = 134;
  }
  const changed = {};
  const dec = new TextDecoder();
  for (const name of wasi.changed) changed[name] = name in wasi.files ? dec.decode(wasi.files[name]) : null;
  return { code, changed };
}

function describeTrap(e) {
  const m = String(e && e.message || e);
  if (/unreachable/.test(m)) return 'abort() o error interno (unreachable)';
  if (/out of bounds/.test(m)) return 'acceso a memoria fuera de rango (puntero o indice incorrecto)';
  if (/divide by zero|integer divide/.test(m)) return 'division entera por cero';
  if (/call stack|stack overflow/i.test(m)) return 'desbordamiento de pila (recursion infinita?)';
  return m;
}
