// Chispa: lenguaje propio de la app (ver ../chispa.js).
import * as io from '../io.js';
import { run as runChispa, ChispaError } from '../chispa.js';

export async function run(files, main, status) {
  status('Ejecutando...');
  try {
    runChispa(files[main] || '', {
      write: (t) => io.write(1, t),
      readLine: (p) => io.readLine(p),
      sleep: (ms) => io.sleep(ms),
      getKey: () => io.getKey(),
      keyAvailable: () => io.keyAvailable(),
    });
    return { code: 0 };
  } catch (e) {
    if (e instanceof ChispaError) {
      io.write(2, `\x1b[31mError${e.line ? ' en la linea ' + e.line : ''}: ${e.message}\x1b[0m\n`);
      return { code: 1, errorLine: e.line };
    }
    io.write(2, `\x1b[31mError interno: ${e && e.message || e}\x1b[0m\n`);
    return { code: 1 };
  }
}
