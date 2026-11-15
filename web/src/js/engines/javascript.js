// JavaScript de consola: se ejecuta en el worker. prompt() lee de la terminal.
import * as io from '../io.js';

function fmt(v, depth = 0) {
  if (typeof v === 'string') return depth ? JSON.stringify(v) : v;
  if (v === undefined) return 'undefined';
  if (typeof v === 'function') return `[Function ${v.name || '(anonima)'}]`;
  if (v instanceof Error) return v.stack || String(v);
  if (typeof v === 'object' && v !== null) {
    if (depth > 3) return Array.isArray(v) ? '[Array]' : '[Object]';
    if (Array.isArray(v)) return '[ ' + v.map((x) => fmt(x, depth + 1)).join(', ') + ' ]';
    if (v instanceof Map) return 'Map { ' + [...v].map(([k, x]) => fmt(k, depth + 1) + ' => ' + fmt(x, depth + 1)).join(', ') + ' }';
    if (v instanceof Set) return 'Set { ' + [...v].map((x) => fmt(x, depth + 1)).join(', ') + ' }';
    try {
      return '{ ' + Object.entries(v).map(([k, x]) => k + ': ' + fmt(x, depth + 1)).join(', ') + ' }';
    } catch (e) { return String(v); }
  }
  return String(v);
}

export async function run(files, main, status) {
  status('Ejecutando...');
  const out = (...a) => io.write(1, a.map((x) => fmt(x)).join(' ') + '\n');
  const err = (...a) => io.write(2, a.map((x) => fmt(x)).join(' ') + '\n');
  const fakeConsole = { log: out, info: out, debug: out, warn: err, error: err, table: out, clear: () => io.write(1, '\x1b[2J\x1b[H') };
  const prompt = (msg = '') => io.readLine(String(msg));
  const alert = (msg = '') => out(msg);
  const sleep = (ms) => io.sleep(ms);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  try {
    const f = new AsyncFunction('console', 'prompt', 'alert', 'sleep', 'getch', 'kbhit', files[main] + '\n//# sourceURL=' + main);
    await f(fakeConsole, prompt, alert, sleep, () => io.getKey(), () => io.keyAvailable());
    return { code: 0 };
  } catch (e) {
    const where = String(e && e.stack || '').match(new RegExp(main.replace(/\./g, '\\.') + ':(\\d+):(\\d+)'));
    io.write(2, `${e && e.name || 'Error'}: ${e && e.message || e}` + (where ? ` (linea ${Number(where[1]) - 2})` : '') + '\n');
    return { code: 1 };
  }
}
