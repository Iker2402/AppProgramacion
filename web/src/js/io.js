// Entrada/salida sincrona dentro del Web Worker.
//
// Los programas (scanf, input(), io.read, leer...) necesitan bloquearse hasta
// que el usuario escribe. Un worker no puede esperar eventos de forma sincrona,
// asi que usamos uno de estos dos canales:
//  1. SharedArrayBuffer + Atomics.wait (cuando la pagina esta aislada, crossOriginIsolated)
//  2. XMLHttpRequest sincrono a /__io/... que la app Android responde cuando hay datos.

export const SAB_SIZE = 64 + 65536 + 1024;
const enc = new TextEncoder();
const dec = new TextDecoder();

let ctrl = null, data = null, keys = null;
let post = () => {};
let outBuf = '';
let errBuf = '';
let lastFlush = 0;
export const term = { cols: 80, rows: 24 };

// Para pruebas automaticas: sustituye la entrada por funciones propias.
let host = null;
export function setHost(h) { host = h; }

// Lee un archivo de texto (fetch en el navegador, fs en Node para las pruebas).
export async function fetchText(url) {
  if (url.protocol === 'file:') {
    const fs = await import('node:fs/promises');
    return fs.readFile(url, 'utf8');
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error('No se pudo cargar ' + url);
  return r.text();
}

export function setupIO(sab, postFn) {
  post = postFn;
  if (sab) {
    ctrl = new Int32Array(sab, 0, 16);
    data = new Uint8Array(sab, 64, 65536);
    keys = new Int32Array(sab, 64 + 65536, 256);
  }
}

let lastFd = 1;
export function write(fd, text) {
  // Mantiene el orden entre salida normal y de error.
  if (fd !== lastFd) { flush(); lastFd = fd; }
  if (fd === 2) errBuf += text; else outBuf += text;
  const now = Date.now();
  if (outBuf.length + errBuf.length > 8192 || now - lastFlush > 40) flush();
}

export function flush() {
  lastFlush = Date.now();
  if (errBuf) { post({ type: 'out', fd: 2, text: errBuf }); errBuf = ''; }
  if (outBuf) { post({ type: 'out', fd: 1, text: outBuf }); outBuf = ''; }
}

function syncGet(path) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', path, false);
  xhr.send(null);
  if (xhr.status !== 200) return null;
  return xhr.responseText;
}

// Pide una linea al usuario. Devuelve null si se cancela (EOF).
export function readLine(prompt) {
  if (prompt) write(1, prompt);
  flush();
  if (host) return host.readLine();
  if (ctrl) {
    Atomics.store(ctrl, 0, 0);
    post({ type: 'input', mode: 'line' });
    Atomics.wait(ctrl, 0, 0);
    const len = ctrl[1];
    if (len < 0) return null;
    return dec.decode(data.slice(0, len));
  }
  post({ type: 'input', mode: 'line' });
  const r = syncGet('/__io/stdin?t=' + Date.now());
  if (r === null || r === '\u0000EOF') return null;
  return r;
}

// Espera una tecla (getch). Devuelve el codigo.
export function getKey() {
  flush();
  if (host) return host.getKey();
  if (ctrl) {
    if (Atomics.load(ctrl, 2) === Atomics.load(ctrl, 3)) post({ type: 'input', mode: 'key' });
    for (;;) {
      const head = Atomics.load(ctrl, 2);
      const tail = Atomics.load(ctrl, 3);
      if (head !== tail) {
        const k = keys[head % 256];
        Atomics.store(ctrl, 2, head + 1);
        post({ type: 'input', mode: 'none' });
        return k;
      }
      Atomics.wait(ctrl, 3, tail);
    }
  }
  post({ type: 'input', mode: 'key' });
  const r = syncGet('/__io/key?wait=1&t=' + Date.now());
  post({ type: 'input', mode: 'none' });
  return r === null ? -1 : parseInt(r, 10);
}

export function keyAvailable() {
  if (host) return host.keyAvailable();
  if (ctrl) return Atomics.load(ctrl, 2) !== Atomics.load(ctrl, 3) ? 1 : 0;
  flush();
  const r = syncGet('/__io/kbhit?t=' + Date.now());
  return r === '1' ? 1 : 0;
}

export function sleep(ms) {
  flush();
  ms = Math.max(0, Math.floor(ms));
  if (ms === 0 || host) return;
  if (ctrl) {
    Atomics.wait(ctrl, 5, 0, ms);
    return;
  }
  if (syncGet('/__io/sleep?ms=' + ms + '&t=' + Date.now()) !== null) return;
  const end = Date.now() + ms;
  while (Date.now() < end) { /* espera activa como ultimo recurso */ }
}

export function bytesToText(bytes) { return dec.decode(bytes, { stream: true }); }
export { enc, dec };
