// Pruebas de integracion de los motores (C, C++, Python, Lua, JavaScript, Chispa).
// Requiere `npm install` y `npm run build` (usa los assets construidos).
//   node test/engines.test.mjs
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const www = resolve(process.env.WWW || resolve(here, '../../android/app/src/main/assets/www'));
const imp = (p) => import(pathToFileURL(resolve(www, p)).href);

const io = await imp('js/io.js');
const { TEMPLATES, EXAMPLES } = await imp('js/examples.js');

let out = '';
let inputs = [];
io.setupIO(null, (m) => { if (m.type === 'out') out += m.text; });
io.setHost({
  readLine: () => { io.flush(); out += '<in>'; return inputs.length ? String(inputs.shift()) : null; },
  getKey: () => 13,
  keyAvailable: () => 0,
});
const status = () => {};
const done = (r) => { io.flush(); return r; };

async function check(name, fn) {
  io.flush();
  out = '';
  const t0 = Date.now();
  try {
    await fn();
    io.flush();
    console.log(`ok   ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    process.exitCode = 1;
    console.log(`FALLO ${name}\n${e.stack}\n--- salida ---\n${out}\n--------------`);
  }
}

const c = await imp('js/engines/c.js');

await check('C: plantilla con stdio, stdlib, time, windows.h, string, stdbool, rlutil y librerias propias', async () => {
  inputs = ['Iker', ...Array.from({ length: 100 }, (_, i) => i + 1)];
  const r = done(await c.run('c', TEMPLATES.c(), status));
  assert.equal(r.code, 0, 'codigo de salida');
  assert.match(out, /Hola, Iker!/);
  assert.match(out, /Correcte en \d+ intents/);
  assert.match(out, /Presione una tecla/);
  assert.match(out, /\x1b\[2J/, 'system("cls") emite borrado ANSI');
});

await check('C: structs y ficheros (fopen/fprintf/fscanf)', async () => {
  const ex = EXAMPLES.find((e) => e.id === 'c-menu');
  inputs = ['2', 'Pau', '30', '1', '3'];
  const r = done(await c.run('c', ex.files(), status));
  assert.equal(r.code, 0);
  assert.match(out, /3\. Pau \(30 anys\)/);
  assert.match(r.changed['persones.txt'], /Pau 30/);
});

await check('C: error de compilacion', async () => {
  const r = done(await c.run('c', { 'main.c': 'int main() { return x; }' }, status));
  assert.notEqual(r.code, 0);
  assert.match(out, /main\.c:1:\d+:.*error/);
});

await check('C++: iostream, string, vector, sort, lambdas', async () => {
  inputs = ['2', 'Ana', '5', 'Marc', '9'];
  const r = done(await c.run('cpp', TEMPLATES.cpp(), status));
  assert.equal(r.code, 0);
  assert.match(out, /Ranking:\n\s+Marc: 9\n\s+Ana: 5/);
});

await check('C++: rlutil y windows.h', async () => {
  const src = '#include <iostream>\n#include <windows.h>\n#include "rlutil.h"\nint main(){ rlutil::setColor(rlutil::RED); std::cout << "rojo"; resetColor(); Sleep(1); system("cls"); return 0; }';
  const r = done(await c.run('cpp', { 'main.cpp': src }, status));
  assert.equal(r.code, 0);
  assert.match(out, /rojo/);
});

await check('C++: excepcion no capturada muestra el mensaje', async () => {
  const src = '#include <vector>\n#include <iostream>\nint main(){ std::vector<int> v; try { std::cout << v.at(3); } catch (...) {} return 0; }';
  const r = done(await c.run('cpp', { 'main.cpp': src }, status));
  assert.equal(r.code, 134);
  assert.match(out, /out_of_range/);
});

const lua = await imp('js/engines/lua.js');
await check('Lua: io.read, tablas, require de otro archivo', async () => {
  inputs = ['5'];
  const r = done(await lua.run({ ...TEMPLATES.lua(), 'util.lua': 'return { doble = function(x) return 2 * x end }' }, 'main.lua', status));
  assert.equal(r.code, 0);
  assert.match(out, /0, 1, 1, 2, 3/);
  const r2 = done(await lua.run({ 'main.lua': 'local u = require("util")\nprint(u.doble(21))', 'util.lua': 'return { doble = function(x) return 2 * x end }' }, 'main.lua', status));
  assert.equal(r2.code, 0);
  assert.match(out, /42/);
});

const js = await imp('js/engines/javascript.js');
await check('JavaScript: prompt y console.log', async () => {
  inputs = ['Iker'];
  const r = done(await js.run(TEMPLATES.javascript(), 'main.js', status));
  assert.equal(r.code, 0);
  assert.match(out, /Hola, Iker!/);
  assert.match(out, /Pares: \[ 2, 4, 6, 8, 10 \]/);
});

const chispa = await imp('js/engines/chispa.js');
await check('Chispa: plantilla y guia', async () => {
  inputs = ['Iker'];
  let r = done(await chispa.run(TEMPLATES.chispa(), 'main.chispa', status));
  assert.equal(r.code, 0);
  assert.match(out, /Primos hasta 50: \[2, 3, 5, 7, 11/);
  const g = EXAMPLES.find((e) => e.id === 'chispa-guia');
  r = done(await chispa.run(g.files(), 'guia.chispa', status));
  assert.equal(r.code, 0, out);
  assert.match(out, /Fin de la guía/);
});

if (!process.env.SKIP_PYTHON) {
  const py = await imp('js/engines/python.js');
  await check('Python: input, f-strings, time.sleep, archivos', async () => {
    inputs = ['Iker', '2'];
    let r = done(await py.run(TEMPLATES.python(), 'main.py', status));
    assert.equal(r.code, 0);
    assert.match(out, /^¿Cómo te llamas\? <in>Hola, Iker! Vamos a tirar dados.\n¿Cuántos dados\? <in>Tirando/);
    assert.match(out, /suma =/);
    r = done(await py.run({ 'main.py': 'import datos\nopen("sal.txt","w").write(datos.X * 2)\nraise ValueError("uy")', 'datos.py': 'X = "ab"' }, 'main.py', status));
    assert.equal(r.code, 1);
    assert.equal(r.changed['sal.txt'], 'abab');
    assert.match(out, /ValueError: uy/);
  });
}
