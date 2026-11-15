// Lua 5.3 (Fengari: maquina virtual de Lua escrita en JavaScript).
import * as io from '../io.js';

let fengari = null;

async function loadFengari() {
  if (!fengari) {
    const src = await io.fetchText(new URL('../../vendor/fengari/fengari-web.js', import.meta.url));
    const module = { exports: {} };
    // El paquete es UMD: lo cargamos como CommonJS dentro del worker.
    new Function('module', 'exports', 'window', src)(module, module.exports, undefined);
    fengari = module.exports;
  }
  return fengari;
}

export async function run(files, main, status) {
  const { lua, lauxlib, lualib, to_luastring, to_jsstring } = await loadFengari();
  status('Ejecutando...');
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  const S = (s) => to_luastring(s);
  const tostr = (i) => { const s = to_jsstring(lauxlib.luaL_tolstring(L, i)); lua.lua_pop(L, 1); return s; };
  const fn = (name, f) => { lua.lua_pushjsfunction(L, f); lua.lua_setglobal(L, S(name)); };

  fn('print', (L) => {
    const n = lua.lua_gettop(L);
    const parts = [];
    for (let i = 1; i <= n; i++) parts.push(tostr(i));
    io.write(1, parts.join('\t') + '\n');
    return 0;
  });
  fn('__cm_write', (L) => {
    const n = lua.lua_gettop(L);
    let s = '';
    for (let i = 1; i <= n; i++) s += tostr(i);
    io.write(1, s);
    return 0;
  });
  fn('__cm_readline', (L) => {
    const l = io.readLine();
    if (l === null) lua.lua_pushnil(L); else lua.lua_pushstring(L, S(l));
    return 1;
  });
  fn('__cm_sleep', (L) => { io.sleep(lauxlib.luaL_checknumber(L, 1) * 1000); return 0; });
  fn('__cm_getch', (L) => { lua.lua_pushinteger(L, io.getKey()); return 1; });
  fn('__cm_kbhit', (L) => { lua.lua_pushboolean(L, io.keyAvailable()); return 1; });
  fn('__cm_src', (L) => {
    const name = to_jsstring(lauxlib.luaL_checkstring(L, 1)).replace(/\./g, '/') + '.lua';
    if (name in files) lua.lua_pushstring(L, S(files[name])); else lua.lua_pushnil(L);
    return 1;
  });

  const prelude = `
io = io or {}
io.write = function(...) __cm_write(...) return io end
io.read = function(fmt)
  fmt = fmt or 'l'
  if type(fmt) == 'string' then fmt = fmt:gsub('^%*', '') end
  if fmt == 'n' then
    local l = __cm_readline()
    return l and tonumber(l)
  elseif fmt == 'a' then
    local t = {}
    while true do local l = __cm_readline(); if not l then break end; t[#t+1] = l end
    return table.concat(t, '\\n')
  elseif fmt == 'L' then
    local l = __cm_readline(); return l and (l .. '\\n')
  else
    return __cm_readline()
  end
end
io.lines = function() return function() return __cm_readline() end end
io.stdout = { write = function(self, ...) __cm_write(...) return self end, flush = function() end, setvbuf = function() end }
io.flush = function() end
os.sleep = __cm_sleep
sleep = __cm_sleep
getch = __cm_getch
kbhit = __cm_kbhit
table.insert(package.searchers, 2, function(name)
  local src = __cm_src(name)
  if src then return load(src, '@' .. name .. '.lua') end
  return '\\n\\tno hay archivo ' .. name .. '.lua en el proyecto'
end)
`;
  if (lauxlib.luaL_dostring(L, S(prelude)) !== 0) throw new Error(tostr(-1));

  // Manejador de errores con traza.
  lua.lua_pushjsfunction(L, (L) => {
    const msg = lua.lua_tostring(L, 1);
    lauxlib.luaL_traceback(L, L, msg, 1);
    return 1;
  });
  const handler = lua.lua_gettop(L);
  const status0 = lauxlib.luaL_loadbuffer(L, S(files[main] || ''), null, S('@' + main));
  if (status0 !== 0) {
    io.write(2, tostr(-1) + '\n');
    return { code: 1 };
  }
  const r = lua.lua_pcall(L, 0, 0, handler);
  if (r !== 0) {
    io.write(2, tostr(-1) + '\n');
    return { code: 1 };
  }
  return { code: 0 };
}
