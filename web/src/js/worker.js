// Worker que ejecuta los programas sin bloquear la interfaz.
import * as io from './io.js';

const engines = {
  c: () => import('./engines/c.js').then((m) => (files, main, st) => m.run('c', files, st)),
  cpp: () => import('./engines/c.js').then((m) => (files, main, st) => m.run('cpp', files, st)),
  python: () => import('./engines/python.js').then((m) => m.run),
  lua: () => import('./engines/lua.js').then((m) => m.run),
  javascript: () => import('./engines/javascript.js').then((m) => m.run),
  chispa: () => import('./engines/chispa.js').then((m) => m.run),
};

const post = (msg) => self.postMessage(msg);

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    io.setupIO(msg.sab, post);
    return;
  }
  if (msg.type === 'resize') {
    io.term.cols = msg.cols;
    io.term.rows = msg.rows;
    return;
  }
  if (msg.type === 'run') {
    io.term.cols = msg.cols || 80;
    io.term.rows = msg.rows || 24;
    const status = (text) => { io.flush(); post({ type: 'status', text }); };
    const t0 = Date.now();
    try {
      const load = engines[msg.lang];
      if (!load) throw new Error('Lenguaje no disponible todavia: ' + msg.lang);
      const runner = await load();
      const result = (await runner(msg.files, msg.main, status)) || { code: 0 };
      io.flush();
      post({ type: 'done', code: result.code, changed: result.changed || {}, errorLine: result.errorLine, ms: Date.now() - t0 });
    } catch (e) {
      io.flush();
      post({ type: 'out', fd: 2, text: '\x1b[31m' + (e && e.message || e) + '\x1b[0m\n' });
      post({ type: 'done', code: 1, changed: {}, ms: Date.now() - t0 });
    }
  }
};
post({ type: 'ready' });
