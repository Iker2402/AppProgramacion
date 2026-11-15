// Servidor local para probar la interfaz en un navegador de escritorio:
//   npm run build -- ../dist && node scripts/serve.mjs ../dist
// Envia cabeceras COOP/COEP para que SharedArrayBuffer este disponible.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';

const dir = resolve(process.argv[2] || '../android/app/src/main/assets/www');
const port = Number(process.env.PORT || 8080);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.zip': 'application/zip', '.tar': 'application/x-tar', '.h': 'text/plain', '.c': 'text/plain' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(dir, path.endsWith('/') ? path + 'index.html' : path));
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path)] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(404);
    res.end('404');
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
