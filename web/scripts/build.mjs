// Copia la interfaz (src/) y las bibliotecas (node_modules/) a los assets de la app Android.
//   node scripts/build.mjs [destino]
import { cpSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || join(root, '../android/app/src/main/assets/www'));
const nm = join(root, 'node_modules');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'src'), out, { recursive: true });

function copy(from, to) {
  const src = join(nm, from);
  if (!existsSync(src)) throw new Error('Falta ' + src + ' (ejecuta npm install)');
  const dst = join(out, 'vendor', to);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
}

// Editor
for (const f of [
  'lib/codemirror.js', 'lib/codemirror.css', 'theme/material-darker.css',
  'addon/mode/simple.js', 'addon/edit/closebrackets.js', 'addon/edit/matchbrackets.js',
  'addon/selection/active-line.js', 'addon/comment/comment.js',
  'mode/clike/clike.js', 'mode/python/python.js', 'mode/lua/lua.js', 'mode/javascript/javascript.js',
  'mode/xml/xml.js', 'mode/css/css.js', 'mode/htmlmixed/htmlmixed.js',
]) copy('codemirror/' + f, 'codemirror/' + f);

// Terminal
copy('@xterm/xterm/lib/xterm.js', 'xterm/xterm.js');
copy('@xterm/xterm/css/xterm.css', 'xterm/xterm.css');
copy('@xterm/addon-fit/lib/addon-fit.js', 'xterm/addon-fit.js');

// Lua
copy('fengari-web/dist/fengari-web.js', 'fengari/fengari-web.js');

// Python (Pyodide)
for (const f of readdirSync(join(nm, 'pyodide'))) {
  if (/\.(mjs|js|wasm|zip|json)$/.test(f) && f !== 'package.json') copy('pyodide/' + f, 'pyodide/' + f);
}

// C/C++ (clang + sysroot)
for (const f of readdirSync(join(nm, '@yowasp/clang/gen'))) copy('@yowasp/clang/gen/' + f, 'clang/' + f);

console.log('Assets listos en', out);
