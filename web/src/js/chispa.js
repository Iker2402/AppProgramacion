// Chispa: un lenguaje sencillo en espanol para practicar.
//
// Este archivo contiene el interprete completo (lexer -> parser -> evaluador).
// Esta escrito para que puedas leerlo y ampliarlo: anade una palabra clave,
// una funcion nueva en BUILTINS o un operador y prueba el resultado.
//
//   mostrar("Hola")             nombre = leer("Nombre: ")
//   si x > 3 entonces ... sino si x > 1 entonces ... sino ... fin
//   mientras x < 10 hacer ... fin
//   para i desde 1 hasta 10 paso 2 hacer ... fin
//   para elemento en lista hacer ... fin
//   repetir 3 veces ... fin
//   funcion suma(a, b) retornar a + b fin
//   clase Perro funcion iniciar(n) yo.nombre = n fin fin
//   intentar ... capturar e ... fin
//   $"Hola {nombre}, tienes {edad} anos"

export class ChispaError extends Error {
  constructor(msg, line) {
    super(msg);
    this.line = line;
  }
}

const KEYWORDS = new Set([
  'si', 'entonces', 'sino', 'fin', 'mientras', 'hacer', 'para', 'en', 'desde', 'hasta', 'paso',
  'repetir', 'veces', 'funcion', 'retornar', 'romper', 'continuar', 'y', 'o', 'no',
  'verdadero', 'falso', 'nulo', 'clase', 'yo', 'intentar', 'capturar', 'lanzar',
]);

// ---------------------------------------------------------------- Lexer
export function tokenize(src) {
  const toks = [];
  let i = 0, line = 1;
  const isIdStart = (c) => /[A-Za-z_À-ɏ]/.test(c);
  const isId = (c) => /[A-Za-z0-9_À-ɏ]/.test(c);
  const push = (type, value) => toks.push({ type, value, line });
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === ';') { i++; continue; }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9_]/.test(src[j])) j++;
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) {
        j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      push('num', Number(src.slice(i, j).replace(/_/g, '')));
      i = j;
      continue;
    }
    if (c === '"' || c === "'" || (c === '$' && (src[i + 1] === '"' || src[i + 1] === "'"))) {
      const interp = c === '$';
      if (interp) i++;
      const q = src[i++];
      let s = '';
      const startLine = line;
      while (i < src.length && src[i] !== q) {
        let ch = src[i++];
        if (ch === '\n') line++;
        if (ch === '\\') {
          const e = src[i++];
          ch = { n: '\n', t: '\t', r: '\r', '0': '\0', e: '\x1b' }[e] ?? e;
          if (interp && (e === '{' || e === '}')) ch = '\\' + e;
        }
        s += ch;
      }
      if (i >= src.length) throw new ChispaError('texto sin cerrar (falta ' + q + ')', startLine);
      i++;
      toks.push({ type: interp ? 'istr' : 'str', value: s, line: startLine });
      continue;
    }
    if (isIdStart(c)) {
      let j = i;
      while (j < src.length && isId(src[j])) j++;
      const w = src.slice(i, j);
      push(KEYWORDS.has(w) ? 'kw' : 'id', w);
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '//'].includes(two)) { push('op', two); i += 2; continue; }
    if ('+-*/%^<>=()[]{},.:'.includes(c)) { push('op', c); i++; continue; }
    throw new ChispaError(`caracter no valido '${c}'`, line);
  }
  push('eof', null);
  return toks;
}

// ---------------------------------------------------------------- Parser
export function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const next = () => toks[p++];
  const is = (type, value, o = 0) => {
    const t = toks[p + o];
    return t.type === type && (value === undefined || t.value === value);
  };
  const accept = (type, value) => (is(type, value) ? next() : null);
  const expect = (type, value, what) => {
    if (is(type, value)) return next();
    const t = peek();
    const got = t.type === 'eof' ? 'el final del archivo' : `'${t.value}'`;
    throw new ChispaError(`se esperaba ${what || `'${value}'`} pero se encontro ${got}`, t.line);
  };

  function block(...enders) {
    const body = [];
    while (!enders.some((e) => is('kw', e)) && !is('eof')) body.push(statement());
    if (is('eof')) throw new ChispaError(`falta '${enders[0]}' para cerrar el bloque`, peek().line);
    return body;
  }

  function statement() {
    const t = peek();
    const line = t.line;
    if (t.type === 'kw') {
      switch (t.value) {
        case 'si': return ifStmt();
        case 'mientras': {
          next();
          const cond = expr();
          accept('kw', 'hacer');
          const body = block('fin');
          next();
          return { k: 'while', cond, body, line };
        }
        case 'para': return forStmt();
        case 'repetir': {
          next();
          const count = expr();
          accept('kw', 'veces');
          const body = block('fin');
          next();
          return { k: 'repeat', count, body, line };
        }
        case 'funcion': {
          if (is('id', undefined, 1)) {
            next();
            const name = next().value;
            const f = funcRest(name, line);
            return { k: 'assign', target: { k: 'var', name, line }, value: f, line };
          }
          break;
        }
        case 'clase': return classStmt();
        case 'retornar': {
          next();
          const value = is('kw', 'fin') || is('kw', 'sino') || is('eof') ? null : expr();
          return { k: 'return', value, line };
        }
        case 'romper': next(); return { k: 'break', line };
        case 'continuar': next(); return { k: 'continue', line };
        case 'lanzar': next(); return { k: 'throw', value: expr(), line };
        case 'intentar': {
          next();
          const body = block('capturar', 'fin');
          let name = null, handler = [];
          if (accept('kw', 'capturar')) {
            if (is('id')) name = next().value;
            handler = block('fin');
          }
          next();
          return { k: 'try', body, name, handler, line };
        }
        default: break;
      }
    }
    const e = expr();
    if (is('op', '=') || is('op', '+=') || is('op', '-=') || is('op', '*=') || is('op', '/=')) {
      const op = next().value;
      if (!['var', 'index', 'member'].includes(e.k)) throw new ChispaError('no se puede asignar a esta expresion', line);
      let value = expr();
      if (op !== '=') value = { k: 'bin', op: op[0], left: e, right: value, line };
      return { k: 'assign', target: e, value, line };
    }
    return { k: 'expr', e, line };
  }

  function ifStmt() {
    const line = next().line;
    const cond = expr();
    accept('kw', 'entonces');
    const then = block('sino', 'fin');
    let otherwise = [];
    if (accept('kw', 'sino')) {
      if (is('kw', 'si')) otherwise = [ifStmt()];
      else { otherwise = block('fin'); next(); }
      return { k: 'if', cond, then, otherwise, line };
    }
    next();
    return { k: 'if', cond, then, otherwise, line };
  }

  function forStmt() {
    const line = next().line;
    const name = expect('id', undefined, 'un nombre de variable').value;
    if (accept('kw', 'desde')) {
      const from = expr();
      expect('kw', 'hasta');
      const to = expr();
      const step = accept('kw', 'paso') ? expr() : null;
      accept('kw', 'hacer');
      const body = block('fin');
      next();
      return { k: 'fornum', name, from, to, step, body, line };
    }
    expect('kw', 'en', "'en' o 'desde'");
    const iter = expr();
    accept('kw', 'hacer');
    const body = block('fin');
    next();
    return { k: 'foreach', name, iter, body, line };
  }

  function classStmt() {
    const line = next().line;
    const name = expect('id', undefined, 'el nombre de la clase').value;
    const methods = {};
    while (!is('kw', 'fin')) {
      const ft = expect('kw', 'funcion', "'funcion' o 'fin'");
      const mname = expect('id', undefined, 'el nombre del metodo').value;
      methods[mname] = funcRest(mname, ft.line);
    }
    next();
    return { k: 'class', name, methods, line };
  }

  function funcRest(name, line) {
    expect('op', '(');
    const params = [];
    if (!is('op', ')')) {
      do params.push(expect('id', undefined, 'un parametro').value); while (accept('op', ','));
    }
    expect('op', ')');
    const body = block('fin');
    next();
    return { k: 'func', name, params, body, line };
  }

  // Precedencia: o < y < no < comparacion < + - < * / % // < ^ < unario < llamada
  function expr() { return or(); }
  function or() {
    let l = and();
    while (is('kw', 'o')) { const line = next().line; l = { k: 'or', left: l, right: and(), line }; }
    return l;
  }
  function and() {
    let l = not();
    while (is('kw', 'y')) { const line = next().line; l = { k: 'and', left: l, right: not(), line }; }
    return l;
  }
  function not() {
    if (is('kw', 'no')) { const line = next().line; return { k: 'not', e: not(), line }; }
    return cmp();
  }
  function cmp() {
    let l = add();
    while (['==', '!=', '<', '<=', '>', '>='].some((o) => is('op', o))) {
      const t = next();
      l = { k: 'bin', op: t.value, left: l, right: add(), line: t.line };
    }
    return l;
  }
  function add() {
    let l = mul();
    while (is('op', '+') || is('op', '-')) {
      const t = next();
      l = { k: 'bin', op: t.value, left: l, right: mul(), line: t.line };
    }
    return l;
  }
  function mul() {
    let l = unary();
    while (is('op', '*') || is('op', '/') || is('op', '%') || is('op', '//')) {
      const t = next();
      l = { k: 'bin', op: t.value, left: l, right: unary(), line: t.line };
    }
    return l;
  }
  function unary() {
    if (is('op', '-')) { const line = next().line; return { k: 'neg', e: unary(), line }; }
    return pow();
  }
  function pow() {
    const base = postfix();
    if (is('op', '^')) { const line = next().line; return { k: 'bin', op: '^', left: base, right: unary(), line }; }
    return base;
  }
  function postfix() {
    let e = primary();
    for (;;) {
      const t = peek();
      if (is('op', '(') && t.line === toks[p - 1].line) {
        next();
        const args = [];
        if (!is('op', ')')) do args.push(expr()); while (accept('op', ','));
        expect('op', ')');
        e = { k: 'call', fn: e, args, line: t.line };
      } else if (is('op', '[')) {
        next();
        const index = expr();
        expect('op', ']');
        e = { k: 'index', obj: e, index, line: t.line };
      } else if (is('op', '.')) {
        next();
        const name = next();
        if (name.type !== 'id' && name.type !== 'kw') throw new ChispaError("se esperaba un nombre despues de '.'", name.line);
        e = { k: 'member', obj: e, name: name.value, line: t.line };
      } else break;
    }
    return e;
  }
  function primary() {
    const t = next();
    const line = t.line;
    switch (t.type) {
      case 'num': return { k: 'lit', v: t.value, line };
      case 'str': return { k: 'lit', v: t.value, line };
      case 'istr': return interpolated(t);
      case 'id': return { k: 'var', name: t.value, line };
      case 'kw':
        if (t.value === 'verdadero') return { k: 'lit', v: true, line };
        if (t.value === 'falso') return { k: 'lit', v: false, line };
        if (t.value === 'nulo') return { k: 'lit', v: null, line };
        if (t.value === 'yo') return { k: 'var', name: 'yo', line };
        if (t.value === 'funcion') return funcRest(null, line);
        break;
      case 'op':
        if (t.value === '(') { const e = expr(); expect('op', ')'); return e; }
        if (t.value === '[') {
          const items = [];
          if (!is('op', ']')) do { if (is('op', ']')) break; items.push(expr()); } while (accept('op', ','));
          expect('op', ']');
          return { k: 'list', items, line };
        }
        if (t.value === '{') {
          const entries = [];
          if (!is('op', '}')) do {
            if (is('op', '}')) break;
            const kt = peek();
            let key;
            if ((kt.type === 'id' || kt.type === 'kw') && is('op', ':', 1)) { next(); key = { k: 'lit', v: kt.value, line: kt.line }; }
            else key = expr();
            expect('op', ':');
            entries.push([key, expr()]);
          } while (accept('op', ','));
          expect('op', '}');
          return { k: 'dict', entries, line };
        }
        break;
      default: break;
    }
    const got = t.type === 'eof' ? 'el final del archivo' : `'${t.value}'`;
    throw new ChispaError(`no se esperaba ${got}`, line);
  }
  function interpolated(t) {
    const parts = [];
    const s = t.value;
    let i = 0, lit = '';
    while (i < s.length) {
      if (s[i] === '\\' && (s[i + 1] === '{' || s[i + 1] === '}')) { lit += s[i + 1]; i += 2; continue; }
      if (s[i] === '{') {
        const j = s.indexOf('}', i);
        if (j < 0) throw new ChispaError("falta '}' en el texto", t.line);
        if (lit) parts.push({ k: 'lit', v: lit, line: t.line });
        lit = '';
        const sub = parse(s.slice(i + 1, j));
        if (sub.length !== 1 || sub[0].k !== 'expr') throw new ChispaError('expresion no valida dentro de {}', t.line);
        parts.push({ k: 'tostr', e: sub[0].e, line: t.line });
        i = j + 1;
        continue;
      }
      lit += s[i++];
    }
    if (lit || parts.length === 0) parts.push({ k: 'lit', v: lit, line: t.line });
    return { k: 'concat', parts, line: t.line };
  }

  const program = [];
  while (!is('eof')) program.push(statement());
  return program;
}

// ---------------------------------------------------------------- Interprete
class Scope {
  constructor(parent = null) { this.vars = new Map(); this.parent = parent; }
  find(name) {
    for (let s = this; s; s = s.parent) if (s.vars.has(name)) return s;
    return null;
  }
  get(name, line) {
    const s = this.find(name);
    if (!s) throw new ChispaError(`la variable '${name}' no existe`, line);
    return s.vars.get(name);
  }
  set(name, v) { (this.find(name) || this).vars.set(name, v); }
}

class Func {
  constructor(node, closure, name) { this.node = node; this.closure = closure; this.name = name || node.name || 'anonima'; }
}
class Builtin {
  constructor(name, fn) { this.name = name; this.fn = fn; }
}
class ClassV {
  constructor(name, methods) { this.name = name; this.methods = methods; }
}
class Instance {
  constructor(cls) { this.cls = cls; this.fields = new Map(); }
}
class BoundMethod {
  constructor(self, func) { this.self = self; this.func = func; }
}

const BREAK = { signal: 'break' };
const CONTINUE = { signal: 'continue' };
class ReturnSignal { constructor(v) { this.v = v; } }
class Thrown { constructor(v, line) { this.v = v; this.line = line; } }

export function typeName(v) {
  if (v === null || v === undefined) return 'nulo';
  if (typeof v === 'number') return 'numero';
  if (typeof v === 'string') return 'texto';
  if (typeof v === 'boolean') return 'logico';
  if (Array.isArray(v)) return 'lista';
  if (v instanceof Map) return 'diccionario';
  if (v instanceof Func || v instanceof Builtin || v instanceof BoundMethod) return 'funcion';
  if (v instanceof ClassV) return 'clase';
  if (v instanceof Instance) return v.cls.name;
  return 'desconocido';
}

export function show(v, nested = false) {
  if (v === null || v === undefined) return 'nulo';
  if (v === true) return 'verdadero';
  if (v === false) return 'falso';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    if (!isFinite(v)) return v > 0 ? 'infinito' : (v < 0 ? '-infinito' : 'no_numero');
    return String(Number(v.toPrecision(12)));
  }
  if (typeof v === 'string') return nested ? JSON.stringify(v) : v;
  if (Array.isArray(v)) return '[' + v.map((x) => show(x, true)).join(', ') + ']';
  if (v instanceof Map) return '{' + [...v].map(([k, x]) => show(k, true) + ': ' + show(x, true)).join(', ') + '}';
  if (v instanceof Func) return `<funcion ${v.name}>`;
  if (v instanceof Builtin) return `<funcion ${v.name}>`;
  if (v instanceof BoundMethod) return `<metodo ${v.func.name}>`;
  if (v instanceof ClassV) return `<clase ${v.name}>`;
  if (v instanceof Instance) {
    return v.cls.name + '{' + [...v.fields].map(([k, x]) => k + ': ' + show(x, true)).join(', ') + '}';
  }
  return String(v);
}

function truthy(v) {
  return !(v === null || v === undefined || v === false || v === 0 || v === '');
}

function equal(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  return a === b;
}

const COLORS = {
  normal: 0, negro: 30, rojo: 31, verde: 32, amarillo: 33, azul: 34, magenta: 35, cian: 36, blanco: 37, gris: 90,
};

export function run(src, host) {
  // host = { write(text), readLine(prompt) -> string|null, sleep(ms), getKey(), keyAvailable(), random() }
  const program = parse(src);
  const globals = new Scope();
  const rnd = host.random || Math.random;
  const need = (name, args, n) => {
    if (args.length < n) throw new ChispaError(`${name}() necesita ${n} argumento${n === 1 ? '' : 's'}`);
  };
  const num = (name, v) => {
    if (typeof v !== 'number') throw new ChispaError(`${name}() espera un numero y recibio ${typeName(v)}`);
    return v;
  };
  const list = (name, v) => {
    if (!Array.isArray(v)) throw new ChispaError(`${name}() espera una lista y recibio ${typeName(v)}`);
    return v;
  };
  const text = (name, v) => {
    if (typeof v !== 'string') throw new ChispaError(`${name}() espera un texto y recibio ${typeName(v)}`);
    return v;
  };

  const B = {
    mostrar: (...a) => { host.write(a.map((x) => show(x)).join(' ') + '\n'); return null; },
    escribir: (...a) => { host.write(a.map((x) => show(x)).join('')); return null; },
    leer: (prompt = '') => { const l = host.readLine(show(prompt)); return l === null ? '' : l; },
    leer_numero: (prompt = '') => {
      for (;;) {
        const l = host.readLine(show(prompt));
        if (l === null) return 0;
        const n = Number(l.trim().replace(',', '.'));
        if (l.trim() !== '' && !isNaN(n)) return n;
        host.write('Escribe un numero, por favor.\n');
      }
    },
    numero: (v) => {
      if (typeof v === 'number') return v;
      const n = Number(String(v).trim().replace(',', '.'));
      if (isNaN(n)) throw new ChispaError(`no se puede convertir ${show(v, true)} a numero`);
      return n;
    },
    entero: (v) => Math.trunc(B.numero(v)),
    texto: (v) => show(v),
    longitud: (v) => {
      if (typeof v === 'string' || Array.isArray(v)) return v.length;
      if (v instanceof Map) return v.size;
      throw new ChispaError(`longitud() no funciona con ${typeName(v)}`);
    },
    tipo: (v) => typeName(v),
    agregar: (l, x) => { list('agregar', l).push(x); return l; },
    insertar: (l, i, x) => { list('insertar', l).splice(num('insertar', i), 0, x); return l; },
    quitar: (l, i) => {
      if (l instanceof Map) { const v = l.get(i); l.delete(i); return v ?? null; }
      list('quitar', l);
      if (l.length === 0) throw new ChispaError('quitar() en una lista vacia');
      if (i === undefined) return l.pop();
      return l.splice(num('quitar', i), 1)[0] ?? null;
    },
    ordenar: (l, f) => {
      list('ordenar', l);
      if (f !== undefined) l.sort((a, b) => num('ordenar', callValue(f, [a, b], 0)));
      else l.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      return l;
    },
    invertir: (v) => (typeof v === 'string' ? [...v].reverse().join('') : list('invertir', v).reverse()),
    contiene: (c, x) => {
      if (typeof c === 'string') return c.includes(show(x));
      if (Array.isArray(c)) return c.some((y) => equal(y, x));
      if (c instanceof Map) return c.has(x);
      throw new ChispaError(`contiene() no funciona con ${typeName(c)}`);
    },
    indice: (c, x) => (typeof c === 'string' ? c.indexOf(show(x)) : list('indice', c).findIndex((y) => equal(y, x))),
    claves: (d) => { if (d instanceof Map) return [...d.keys()]; if (d instanceof Instance) return [...d.fields.keys()]; throw new ChispaError('claves() espera un diccionario'); },
    valores: (d) => { if (d instanceof Map) return [...d.values()]; throw new ChispaError('valores() espera un diccionario'); },
    rango: (a, b, s) => {
      if (b === undefined) { b = a; a = 0; }
      s = s === undefined ? 1 : s;
      num('rango', a); num('rango', b); num('rango', s);
      if (s === 0) throw new ChispaError('rango() con paso 0');
      const r = [];
      for (let i = a; s > 0 ? i < b : i > b; i += s) { r.push(i); if (r.length > 1e7) throw new ChispaError('rango demasiado grande'); }
      return r;
    },
    aleatorio: (a, b) => {
      if (a === undefined) return rnd();
      if (Array.isArray(a)) return a.length ? a[Math.floor(rnd() * a.length)] : null;
      if (b === undefined) { b = a; a = 1; }
      num('aleatorio', a); num('aleatorio', b);
      return Math.floor(rnd() * (b - a + 1)) + a;
    },
    redondear: (x, d = 0) => { const f = 10 ** num('redondear', d); return Math.round(num('redondear', x) * f) / f; },
    piso: (x) => Math.floor(num('piso', x)),
    techo: (x) => Math.ceil(num('techo', x)),
    raiz: (x) => Math.sqrt(num('raiz', x)),
    potencia: (a, b) => num('potencia', a) ** num('potencia', b),
    abs: (x) => Math.abs(num('abs', x)),
    seno: (x) => Math.sin(num('seno', x)),
    coseno: (x) => Math.cos(num('coseno', x)),
    PI: Math.PI,
    maximo: (...a) => { const v = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return v.reduce((m, x) => (x > m ? x : m)); },
    minimo: (...a) => { const v = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return v.reduce((m, x) => (x < m ? x : m)); },
    suma: (l) => list('suma', l).reduce((s, x) => s + num('suma', x), 0),
    mayusculas: (s) => text('mayusculas', s).toUpperCase(),
    minusculas: (s) => text('minusculas', s).toLowerCase(),
    recortar: (s) => text('recortar', s).trim(),
    dividir: (s, sep) => (sep === undefined ? text('dividir', s).split(/\s+/).filter(Boolean) : text('dividir', s).split(show(sep))),
    unir: (l, sep = '') => list('unir', l).map((x) => show(x)).join(show(sep)),
    reemplazar: (s, a, b) => text('reemplazar', s).split(show(a)).join(show(b)),
    subtexto: (s, ini, fin) => text('subtexto', s).slice(num('subtexto', ini), fin === undefined ? undefined : num('subtexto', fin)),
    empieza: (s, x) => text('empieza', s).startsWith(show(x)),
    termina: (s, x) => text('termina', s).endsWith(show(x)),
    caracter: (n) => String.fromCodePoint(num('caracter', n)),
    codigo: (s) => text('codigo', s).codePointAt(0) ?? 0,
    copiar: (v) => (Array.isArray(v) ? v.slice() : v instanceof Map ? new Map(v) : v),
    mapa: (l, f) => list('mapa', l).map((x, i) => callValue(f, [x, i], 0)),
    filtrar: (l, f) => list('filtrar', l).filter((x, i) => truthy(callValue(f, [x, i], 0))),
    reducir: (l, f, ini) => list('reducir', l).reduce((acc, x) => callValue(f, [acc, x], 0), ini),
    esperar: (s) => { host.sleep(num('esperar', s) * 1000); return null; },
    limpiar: () => { host.write('\x1b[2J\x1b[H'); return null; },
    color: (c) => {
      const code = COLORS[String(c).toLowerCase()];
      if (code === undefined) throw new ChispaError('colores: ' + Object.keys(COLORS).join(', '));
      host.write(`\x1b[${code}m`);
      return null;
    },
    posicion: (x, y) => { host.write(`\x1b[${num('posicion', y)};${num('posicion', x)}H`); return null; },
    tecla: () => { const k = host.getKey(); return k < 0 ? '' : String.fromCharCode(k); },
    hay_tecla: () => !!host.keyAvailable(),
    tiempo: () => Date.now() / 1000,
    fecha: () => new Date().toLocaleString('es-ES'),
    error: (msg) => { throw new Thrown(msg, null); },
    afirmar: (cond, msg = 'la afirmacion ha fallado') => { if (!truthy(cond)) throw new ChispaError(show(msg)); return null; },
  };
  for (const [name, v] of Object.entries(B)) globals.vars.set(name, typeof v === 'function' ? new Builtin(name, v) : v);

  function callValue(f, args, line) {
    if (f instanceof Builtin) {
      try { return f.fn(...args); } catch (e) {
        if (e instanceof ChispaError && e.line === undefined) e.line = line;
        throw e;
      }
    }
    if (f instanceof BoundMethod) return callFunc(f.func, args, line, f.self);
    if (f instanceof Func) return callFunc(f, args, line, null);
    if (f instanceof ClassV) {
      const obj = new Instance(f);
      if (f.methods.iniciar) callFunc(f.methods.iniciar, args, line, obj);
      return obj;
    }
    throw new ChispaError(`${show(f, true)} no es una funcion`, line);
  }

  let depth = 0;
  function callFunc(f, args, line, self) {
    const scope = new Scope(f.closure);
    f.node.params.forEach((p, i) => scope.vars.set(p, args[i] === undefined ? null : args[i]));
    if (self) scope.vars.set('yo', self);
    if (++depth > 2000) { depth = 0; throw new ChispaError(`demasiadas llamadas anidadas en '${f.name}' (recursion infinita?)`, line); }
    try {
      execBlock(f.node.body, scope);
      return null;
    } catch (e) {
      if (e instanceof ReturnSignal) return e.v;
      throw e;
    } finally {
      depth--;
    }
  }

  function execBlock(stmts, scope) {
    for (const s of stmts) exec(s, scope);
  }

  function loopBody(body, scope) {
    try { execBlock(body, scope); } catch (e) {
      if (e === BREAK) return false;
      if (e === CONTINUE) return true;
      throw e;
    }
    return true;
  }

  function exec(s, scope) {
    switch (s.k) {
      case 'expr': evaluate(s.e, scope); return;
      case 'assign': {
        const v = evaluate(s.value, scope);
        if (v instanceof Func && s.target.k === 'var' && v.name === 'anonima') v.name = s.target.name;
        assign(s.target, v, scope);
        return;
      }
      case 'if':
        if (truthy(evaluate(s.cond, scope))) execBlock(s.then, scope); else execBlock(s.otherwise, scope);
        return;
      case 'while':
        while (truthy(evaluate(s.cond, scope))) if (!loopBody(s.body, scope)) break;
        return;
      case 'repeat': {
        const n = evaluate(s.count, scope);
        if (typeof n !== 'number') throw new ChispaError('repetir necesita un numero', s.line);
        for (let i = 0; i < n; i++) if (!loopBody(s.body, scope)) break;
        return;
      }
      case 'fornum': {
        const from = evaluate(s.from, scope);
        const to = evaluate(s.to, scope);
        const step = s.step ? evaluate(s.step, scope) : 1;
        if (typeof from !== 'number' || typeof to !== 'number' || typeof step !== 'number')
          throw new ChispaError("'para ... desde ... hasta' necesita numeros", s.line);
        if (step === 0) throw new ChispaError('el paso no puede ser 0', s.line);
        for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
          scope.set(s.name, i);
          if (!loopBody(s.body, scope)) break;
        }
        return;
      }
      case 'foreach': {
        let it = evaluate(s.iter, scope);
        if (typeof it === 'string') it = [...it];
        else if (it instanceof Map) it = [...it.keys()];
        else if (!Array.isArray(it)) throw new ChispaError(`no se puede recorrer ${typeName(it)}`, s.line);
        for (const x of it.slice()) {
          scope.set(s.name, x);
          if (!loopBody(s.body, scope)) break;
        }
        return;
      }
      case 'class': {
        const methods = {};
        for (const [n, f] of Object.entries(s.methods)) methods[n] = new Func(f, scope, n);
        scope.set(s.name, new ClassV(s.name, methods));
        return;
      }
      case 'return': throw new ReturnSignal(s.value ? evaluate(s.value, scope) : null);
      case 'break': throw BREAK;
      case 'continue': throw CONTINUE;
      case 'throw': throw new Thrown(evaluate(s.value, scope), s.line);
      case 'try': {
        try {
          execBlock(s.body, scope);
        } catch (e) {
          let v;
          if (e instanceof Thrown) v = e.v;
          else if (e instanceof ChispaError) v = e.message;
          else throw e;
          if (s.name) scope.set(s.name, v);
          execBlock(s.handler, scope);
        }
        return;
      }
      default: throw new ChispaError('instruccion desconocida ' + s.k, s.line);
    }
  }

  function assign(t, v, scope) {
    if (t.k === 'var') {
      if (t.name === 'yo') throw new ChispaError("no se puede asignar a 'yo'", t.line);
      scope.set(t.name, v);
    } else if (t.k === 'index') {
      const o = evaluate(t.obj, scope);
      const i = evaluate(t.index, scope);
      if (Array.isArray(o)) {
        const idx = checkIndex(o, i, t.line);
        o[idx] = v;
      } else if (o instanceof Map) o.set(i, v);
      else if (o instanceof Instance) o.fields.set(show(i), v);
      else throw new ChispaError(`no se puede usar [] con ${typeName(o)}`, t.line);
    } else if (t.k === 'member') {
      const o = evaluate(t.obj, scope);
      if (o instanceof Instance) o.fields.set(t.name, v);
      else if (o instanceof Map) o.set(t.name, v);
      else throw new ChispaError(`no se puede asignar '.${t.name}' en ${typeName(o)}`, t.line);
    }
  }

  function checkIndex(o, i, line) {
    if (typeof i !== 'number' || !Number.isInteger(i)) throw new ChispaError('el indice debe ser un numero entero', line);
    const idx = i < 0 ? o.length + i : i;
    if (idx < 0 || idx >= o.length) throw new ChispaError(`indice ${i} fuera de rango (longitud ${o.length})`, line);
    return idx;
  }

  function member(o, name, line) {
    if (o instanceof Instance) {
      if (o.fields.has(name)) return o.fields.get(name);
      if (o.cls.methods[name]) return new BoundMethod(o, o.cls.methods[name]);
    }
    if (o instanceof Map && o.has(name)) return o.get(name);
    // Azucar: lista.agregar(3) == agregar(lista, 3); nombre.mayusculas() == mayusculas(nombre)
    if (B[name] && typeof B[name] === 'function') return new Builtin(name, (...a) => B[name](o, ...a));
    throw new ChispaError(`${typeName(o)} no tiene '${name}'`, line);
  }

  function arith(op, a, b, line) {
    if (op === '+') {
      if (typeof a === 'number' && typeof b === 'number') return a + b;
      if (typeof a === 'string' || typeof b === 'string') return show(a) + show(b);
      if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
      throw new ChispaError(`no se puede sumar ${typeName(a)} y ${typeName(b)}`, line);
    }
    if (op === '*' && typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, b));
    if (op === '*' && Array.isArray(a) && typeof b === 'number') { let r = []; for (let i = 0; i < b; i++) r = r.concat(a); return r; }
    if (['<', '<=', '>', '>='].includes(op)) {
      if (!((typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string')))
        throw new ChispaError(`no se puede comparar ${typeName(a)} con ${typeName(b)}`, line);
      return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
    }
    if (typeof a !== 'number' || typeof b !== 'number')
      throw new ChispaError(`la operacion '${op}' necesita numeros (recibio ${typeName(a)} y ${typeName(b)})`, line);
    switch (op) {
      case '-': return a - b;
      case '*': return a * b;
      case '/': if (b === 0) throw new ChispaError('division por cero', line); return a / b;
      case '//': if (b === 0) throw new ChispaError('division por cero', line); return Math.floor(a / b);
      case '%': if (b === 0) throw new ChispaError('division por cero', line); return ((a % b) + b) % b;
      case '^': return a ** b;
      default: throw new ChispaError('operador desconocido ' + op, line);
    }
  }

  function evaluate(e, scope) {
    switch (e.k) {
      case 'lit': return e.v;
      case 'var': return scope.get(e.name, e.line);
      case 'list': return e.items.map((x) => evaluate(x, scope));
      case 'dict': return new Map(e.entries.map(([k, v]) => [evaluate(k, scope), evaluate(v, scope)]));
      case 'func': return new Func(e, scope);
      case 'concat': return e.parts.map((p) => show(evaluate(p, scope))).join('');
      case 'tostr': return show(evaluate(e.e, scope));
      case 'neg': {
        const v = evaluate(e.e, scope);
        if (typeof v !== 'number') throw new ChispaError(`no se puede negar ${typeName(v)}`, e.line);
        return -v;
      }
      case 'not': return !truthy(evaluate(e.e, scope));
      case 'and': { const l = evaluate(e.left, scope); return truthy(l) ? evaluate(e.right, scope) : l; }
      case 'or': { const l = evaluate(e.left, scope); return truthy(l) ? l : evaluate(e.right, scope); }
      case 'bin': {
        const a = evaluate(e.left, scope);
        const b = evaluate(e.right, scope);
        if (e.op === '==') return equal(a, b);
        if (e.op === '!=') return !equal(a, b);
        return arith(e.op, a, b, e.line);
      }
      case 'index': {
        const o = evaluate(e.obj, scope);
        const i = evaluate(e.index, scope);
        if (Array.isArray(o) || typeof o === 'string') return o[checkIndex(o, i, e.line)];
        if (o instanceof Map) {
          if (!o.has(i)) throw new ChispaError(`la clave ${show(i, true)} no existe`, e.line);
          return o.get(i);
        }
        if (o instanceof Instance) return member(o, show(i), e.line);
        throw new ChispaError(`no se puede usar [] con ${typeName(o)}`, e.line);
      }
      case 'member': return member(evaluate(e.obj, scope), e.name, e.line);
      case 'call': {
        const f = evaluate(e.fn, scope);
        const args = e.args.map((a) => evaluate(a, scope));
        return callValue(f, args, e.line);
      }
      default: throw new ChispaError('expresion desconocida ' + e.k, e.line);
    }
  }

  try {
    execBlock(program, globals);
  } catch (e) {
    if (e instanceof ReturnSignal) return;
    if (e === BREAK || e === CONTINUE) throw new ChispaError("'romper' o 'continuar' fuera de un bucle");
    if (e instanceof Thrown) throw new ChispaError('error no capturado: ' + show(e.v), e.line);
    if (e instanceof RangeError) throw new ChispaError('demasiadas llamadas anidadas (recursion infinita?)');
    throw e;
  }
}
