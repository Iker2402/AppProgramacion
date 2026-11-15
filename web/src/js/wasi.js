// Implementacion minima de WASI preview1 para ejecutar los programas C/C++
// compilados con clang (wasm32-wasip1). Funciona en un Web Worker y en Node.
//
// io = {
//   write(fd, Uint8Array)        salida estandar (1) y de error (2)
//   readStdin() -> string|null   bloquea hasta que el usuario escribe una linea
//   getch() -> number            bloquea hasta una tecla
//   kbhit() -> 0|1
//   sleep(ms)
//   cols, rows
// }
// files = { "datos.txt": Uint8Array, ... }  sistema de archivos en memoria (directorio "/")

const E = { SUCCESS: 0, BADF: 8, EXIST: 20, INVAL: 28, ISDIR: 31, NOENT: 44, NOSYS: 52, NOTDIR: 54, SPIPE: 70 };
const FT = { CHAR: 2, DIR: 3, FILE: 4 };
const ALL_RIGHTS = 0xffffffffffffffffn;

export class WasiExit extends Error {
  constructor(code) {
    super('exit ' + code);
    this.code = code;
  }
}

export class Wasi {
  constructor({ args = ['programa'], env = {}, io, files = {} }) {
    this.args = args;
    this.env = Object.entries(env).map(([k, v]) => `${k}=${v}`);
    this.io = io;
    this.files = files; // nombre -> Uint8Array
    this.changed = new Set();
    this.fds = new Map();
    this.fds.set(0, { type: 'stdin' });
    this.fds.set(1, { type: 'out' });
    this.fds.set(2, { type: 'out' });
    this.fds.set(3, { type: 'dir', path: '/' });
    this.nextFd = 4;
    this.stdinBuf = new Uint8Array(0);
    this.stdinEOF = false;
    this.enc = new TextEncoder();
    this.dec = new TextDecoder();
    this.memory = null;
  }

  get view() { return new DataView(this.memory.buffer); }
  get bytes() { return new Uint8Array(this.memory.buffer); }
  str(ptr, len) { return this.dec.decode(this.bytes.slice(ptr, ptr + len)); }

  normPath(p) {
    const parts = [];
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop(); else parts.push(seg);
    }
    return parts.join('/');
  }

  imports(module) {
    const self = this;
    const w = {
      args_sizes_get(argc, bufSize) {
        const v = self.view;
        v.setUint32(argc, self.args.length, true);
        v.setUint32(bufSize, self.args.reduce((n, a) => n + self.enc.encode(a).length + 1, 0), true);
        return 0;
      },
      args_get(argv, buf) { return self.writeStrings(self.args, argv, buf); },
      environ_sizes_get(cnt, bufSize) {
        const v = self.view;
        v.setUint32(cnt, self.env.length, true);
        v.setUint32(bufSize, self.env.reduce((n, a) => n + self.enc.encode(a).length + 1, 0), true);
        return 0;
      },
      environ_get(envp, buf) { return self.writeStrings(self.env, envp, buf); },
      clock_res_get(id, out) { self.view.setBigUint64(out, 1000n, true); return 0; },
      clock_time_get(id, precision, out) {
        let ns;
        if (id === 0) ns = BigInt(Date.now()) * 1000000n;
        else ns = BigInt(Math.round(performance.now() * 1e6));
        self.view.setBigUint64(out, ns, true);
        return 0;
      },
      random_get(ptr, len) {
        const b = self.bytes;
        for (let off = 0; off < len; off += 65536) {
          const n = Math.min(65536, len - off);
          const tmp = new Uint8Array(n);
          crypto.getRandomValues(tmp);
          b.set(tmp, ptr + off);
        }
        return 0;
      },
      proc_exit(code) { throw new WasiExit(code); },
      proc_raise() { return E.NOSYS; },
      sched_yield() { return 0; },
      fd_advise() { return 0; },
      fd_allocate() { return 0; },
      fd_datasync() { return 0; },
      fd_sync() { return 0; },
      fd_close(fd) {
        if (!self.fds.has(fd)) return E.BADF;
        if (fd > 3) self.fds.delete(fd);
        return 0;
      },
      fd_fdstat_get(fd, out) {
        const f = self.fds.get(fd);
        if (!f) return E.BADF;
        const v = self.view;
        const type = f.type === 'dir' ? FT.DIR : f.type === 'file' ? FT.FILE : FT.CHAR;
        v.setUint8(out, type);
        v.setUint16(out + 2, f.append ? 1 : 0, true);
        v.setBigUint64(out + 8, ALL_RIGHTS, true);
        v.setBigUint64(out + 16, ALL_RIGHTS, true);
        return 0;
      },
      fd_fdstat_set_flags() { return 0; },
      fd_fdstat_set_rights() { return 0; },
      fd_prestat_get(fd, out) {
        const f = self.fds.get(fd);
        if (!f || f.type !== 'dir' || fd !== 3) return E.BADF;
        self.view.setUint8(out, 0);
        self.view.setUint32(out + 4, self.enc.encode(f.path).length, true);
        return 0;
      },
      fd_prestat_dir_name(fd, ptr, len) {
        const f = self.fds.get(fd);
        if (!f || f.type !== 'dir') return E.BADF;
        self.bytes.set(self.enc.encode(f.path).slice(0, len), ptr);
        return 0;
      },
      fd_filestat_get(fd, out) {
        const f = self.fds.get(fd);
        if (!f) return E.BADF;
        if (f.type === 'file') return self.writeStat(out, FT.FILE, (self.files[f.name] || new Uint8Array(0)).length);
        return self.writeStat(out, f.type === 'dir' ? FT.DIR : FT.CHAR, 0);
      },
      fd_filestat_set_size(fd, size) {
        const f = self.fds.get(fd);
        if (!f || f.type !== 'file') return E.BADF;
        const old = self.files[f.name] || new Uint8Array(0);
        const n = new Uint8Array(Number(size));
        n.set(old.slice(0, n.length));
        self.files[f.name] = n;
        self.changed.add(f.name);
        return 0;
      },
      fd_filestat_set_times() { return 0; },
      fd_write(fd, iovs, iovsLen, nwritten) {
        const f = self.fds.get(fd);
        if (!f) return E.BADF;
        const v = self.view;
        const chunks = [];
        let total = 0;
        for (let i = 0; i < iovsLen; i++) {
          const ptr = v.getUint32(iovs + i * 8, true);
          const len = v.getUint32(iovs + i * 8 + 4, true);
          chunks.push(self.bytes.slice(ptr, ptr + len));
          total += len;
        }
        const data = concat(chunks, total);
        if (f.type === 'out') self.io.write(fd, data);
        else if (f.type === 'file') self.fileWrite(f, data);
        else return E.BADF;
        self.view.setUint32(nwritten, total, true);
        return 0;
      },
      fd_pwrite() { return E.NOSYS; },
      fd_read(fd, iovs, iovsLen, nread) {
        const f = self.fds.get(fd);
        if (!f) return E.BADF;
        const v = self.view;
        let want = 0;
        for (let i = 0; i < iovsLen; i++) want += v.getUint32(iovs + i * 8 + 4, true);
        let data;
        if (f.type === 'stdin') data = self.stdinRead(want);
        else if (f.type === 'file') {
          const content = self.files[f.name] || new Uint8Array(0);
          data = content.slice(f.pos, f.pos + want);
          f.pos += data.length;
        } else return E.BADF;
        let off = 0;
        const b = self.bytes;
        for (let i = 0; i < iovsLen && off < data.length; i++) {
          const ptr = v.getUint32(iovs + i * 8, true);
          const len = v.getUint32(iovs + i * 8 + 4, true);
          const n = Math.min(len, data.length - off);
          b.set(data.subarray(off, off + n), ptr);
          off += n;
        }
        self.view.setUint32(nread, off, true);
        return 0;
      },
      fd_pread() { return E.NOSYS; },
      fd_seek(fd, offset, whence, out) {
        const f = self.fds.get(fd);
        if (!f) return E.BADF;
        if (f.type !== 'file') return E.SPIPE;
        const size = (self.files[f.name] || new Uint8Array(0)).length;
        const base = whence === 0 ? 0 : whence === 1 ? f.pos : size;
        const np = base + Number(offset);
        if (np < 0) return E.INVAL;
        f.pos = np;
        self.view.setBigUint64(out, BigInt(np), true);
        return 0;
      },
      fd_tell(fd, out) {
        const f = self.fds.get(fd);
        if (!f) return E.BADF;
        if (f.type !== 'file') return E.SPIPE;
        self.view.setBigUint64(out, BigInt(f.pos), true);
        return 0;
      },
      fd_readdir(fd, buf, len, cookie, used) {
        const f = self.fds.get(fd);
        if (!f || f.type !== 'dir') return E.BADF;
        const names = Object.keys(self.files);
        const v = self.view;
        let off = 0;
        for (let i = Number(cookie); i < names.length; i++) {
          const nb = self.enc.encode(names[i]);
          if (off + 24 + nb.length > len) { off = len; break; }
          v.setBigUint64(buf + off, BigInt(i + 1), true);
          v.setBigUint64(buf + off + 8, BigInt(i + 1), true);
          v.setUint32(buf + off + 16, nb.length, true);
          v.setUint8(buf + off + 20, FT.FILE);
          self.bytes.set(nb, buf + off + 24);
          off += 24 + nb.length;
        }
        v.setUint32(used, off, true);
        return 0;
      },
      fd_renumber() { return E.NOSYS; },
      path_open(dirfd, dirflags, pathPtr, pathLen, oflags, rightsBase, rightsInh, fdflags, out) {
        const name = self.normPath(self.str(pathPtr, pathLen));
        if (name === '') {
          const fd = self.nextFd++;
          self.fds.set(fd, { type: 'dir', path: '/' });
          self.view.setUint32(out, fd, true);
          return 0;
        }
        if (oflags & 2) return E.NOTDIR;
        const exists = Object.prototype.hasOwnProperty.call(self.files, name);
        if (!exists && !(oflags & 1)) return E.NOENT;
        if (exists && (oflags & 4)) return E.EXIST;
        if (!exists || (oflags & 8)) {
          self.files[name] = new Uint8Array(0);
          self.changed.add(name);
        }
        const fd = self.nextFd++;
        self.fds.set(fd, { type: 'file', name, pos: 0, append: !!(fdflags & 1) });
        self.view.setUint32(out, fd, true);
        return 0;
      },
      path_filestat_get(dirfd, flags, pathPtr, pathLen, out) {
        const name = self.normPath(self.str(pathPtr, pathLen));
        if (name === '') return self.writeStat(out, FT.DIR, 0);
        if (!Object.prototype.hasOwnProperty.call(self.files, name)) return E.NOENT;
        return self.writeStat(out, FT.FILE, self.files[name].length);
      },
      path_filestat_set_times() { return 0; },
      path_unlink_file(dirfd, pathPtr, pathLen) {
        const name = self.normPath(self.str(pathPtr, pathLen));
        if (!Object.prototype.hasOwnProperty.call(self.files, name)) return E.NOENT;
        delete self.files[name];
        self.changed.add(name);
        return 0;
      },
      path_rename(fd1, p1, l1, fd2, p2, l2) {
        const a = self.normPath(self.str(p1, l1));
        const b = self.normPath(self.str(p2, l2));
        if (!Object.prototype.hasOwnProperty.call(self.files, a)) return E.NOENT;
        self.files[b] = self.files[a];
        delete self.files[a];
        self.changed.add(a);
        self.changed.add(b);
        return 0;
      },
      path_create_directory() { return E.NOSYS; },
      path_remove_directory() { return E.NOSYS; },
      path_link() { return E.NOSYS; },
      path_symlink() { return E.NOSYS; },
      path_readlink() { return E.NOSYS; },
      poll_oneoff(inPtr, outPtr, nsubs, nevents) {
        const v = self.view;
        let sleepNs = 0n;
        let n = 0;
        for (let i = 0; i < nsubs; i++) {
          const s = inPtr + i * 48;
          const userdata = v.getBigUint64(s, true);
          const tag = v.getUint8(s + 8);
          if (tag === 0) {
            const timeout = v.getBigUint64(s + 24, true);
            const flags = v.getUint16(s + 40, true);
            let t = timeout;
            if (flags & 1) t = timeout - BigInt(Date.now()) * 1000000n;
            if (t > sleepNs) sleepNs = t;
          }
          const e = outPtr + n * 32;
          v.setBigUint64(e, userdata, true);
          v.setUint16(e + 8, 0, true);
          v.setUint8(e + 10, tag);
          n++;
        }
        if (sleepNs > 0n) self.io.sleep(Number(sleepNs / 1000000n));
        self.view.setUint32(nevents, n, true);
        return 0;
      },
      sock_accept() { return E.NOSYS; },
      sock_recv() { return E.NOSYS; },
      sock_send() { return E.NOSYS; },
      sock_shutdown() { return E.NOSYS; },
    };
    const compat = {
      getch() { return self.io.getch(); },
      kbhit() { return self.io.kbhit(); },
      sleep_ms(ms) { self.io.sleep(ms); },
      term_cols() { return self.io.cols || 80; },
      term_rows() { return self.io.rows || 24; },
    };
    // Rellena cualquier import que falte con una funcion que devuelve ENOSYS.
    const imports = { wasi_snapshot_preview1: w, wasi_unstable: w, compat };
    for (const imp of WebAssembly.Module.imports(module)) {
      if (imp.kind !== 'function') continue;
      imports[imp.module] = imports[imp.module] || {};
      if (!imports[imp.module][imp.name]) imports[imp.module][imp.name] = () => E.NOSYS;
    }
    return imports;
  }

  writeStrings(list, ptrs, buf) {
    const v = this.view;
    let off = buf;
    list.forEach((s, i) => {
      const b = this.enc.encode(s);
      v.setUint32(ptrs + i * 4, off, true);
      this.bytes.set(b, off);
      this.bytes[off + b.length] = 0;
      off += b.length + 1;
    });
    return 0;
  }

  writeStat(out, type, size) {
    const v = this.view;
    for (let i = 0; i < 64; i += 8) v.setBigUint64(out + i, 0n, true);
    v.setUint8(out + 16, type);
    v.setBigUint64(out + 24, 1n, true);
    v.setBigUint64(out + 32, BigInt(size), true);
    return 0;
  }

  fileWrite(f, data) {
    const old = this.files[f.name] || new Uint8Array(0);
    const pos = f.append ? old.length : f.pos;
    const size = Math.max(old.length, pos + data.length);
    const n = new Uint8Array(size);
    n.set(old);
    n.set(data, pos);
    this.files[f.name] = n;
    f.pos = pos + data.length;
    this.changed.add(f.name);
  }

  stdinRead(want) {
    if (this.stdinBuf.length === 0 && !this.stdinEOF) {
      const line = this.io.readStdin();
      if (line === null || line === undefined) this.stdinEOF = true;
      else this.stdinBuf = this.enc.encode(line + '\n');
    }
    const data = this.stdinBuf.slice(0, want);
    this.stdinBuf = this.stdinBuf.slice(data.length);
    return data;
  }

  // Ejecuta el programa. Devuelve el codigo de salida.
  start(module) {
    const instance = new WebAssembly.Instance(module, this.imports(module));
    this.memory = instance.exports.memory;
    try {
      instance.exports._start();
      return 0;
    } catch (e) {
      if (e instanceof WasiExit) return e.code;
      throw e;
    }
  }
}

function concat(chunks, total) {
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
