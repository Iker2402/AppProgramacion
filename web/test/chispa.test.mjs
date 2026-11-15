// Pruebas del interprete de Chispa: node test/chispa.test.mjs
import { run, ChispaError } from '../src/js/chispa.js';
import assert from 'node:assert/strict';

function exec(src, inputs = []) {
  let out = '';
  run(src, {
    write: (t) => { out += t; },
    readLine: (p) => { out += p; return inputs.length ? inputs.shift() : null; },
    sleep: () => {}, getKey: () => 65, keyAvailable: () => 0,
  });
  return out;
}

const cases = [
  ['mostrar("Hola", 1 + 2)', 'Hola 3\n'],
  ['x = 10\nsi x > 5 entonces\n mostrar("grande")\nsino\n mostrar("peque")\nfin', 'grande\n'],
  ['x = 3\nsi x > 5 mostrar("a") sino si x > 2 mostrar("b") sino mostrar("c") fin', 'b\n'],
  ['funcion fact(n)\n si n <= 1 entonces retornar 1 fin\n retornar n * fact(n - 1)\nfin\nmostrar(fact(5))', '120\n'],
  ['para i desde 1 hasta 3 hacer escribir(i) fin', '123'],
  ['para i desde 10 hasta 0 paso -5 hacer escribir(i, " ") fin', '10 5 0 '],
  ['l = [3, 1, 2]\nl.agregar(0)\nordenar(l)\nmostrar(l, longitud(l))', '[0, 1, 2, 3] 4\n'],
  ['d = {nombre: "Iker", edad: 20}\nd["ciudad"] = "BCN"\nmostrar(d.nombre, d["edad"], claves(d))', 'Iker 20 ["nombre", "edad", "ciudad"]\n'],
  ['n = leer("Nombre: ")\nmostrar($"Hola {n}, {2 * 3}")', 'Nombre: Hola Ana, 6\n', ['Ana']],
  ['repetir 3 veces escribir("x") fin', 'xxx'],
  ['i = 0\nmientras verdadero hacer\n i += 1\n si i == 2 continuar fin\n si i > 4 romper fin\n escribir(i)\nfin', '134'],
  ['clase Perro\n funcion iniciar(n) yo.nombre = n fin\n funcion ladrar() retornar yo.nombre + " dice guau" fin\nfin\np = Perro("Toby")\nmostrar(p.ladrar())', 'Toby dice guau\n'],
  ['intentar\n error("fallo")\ncapturar e\n mostrar("capturado:", e)\nfin', 'capturado: fallo\n'],
  ['doble = funcion(x) retornar x * 2 fin\nmostrar(mapa([1,2,3], doble), filtrar(rango(10), funcion(x) retornar x % 2 == 0 fin))', '[2, 4, 6] [0, 2, 4, 6, 8]\n'],
  ['mostrar(7 / 2, 7 // 2, 7 % 3, 2 ^ 10, "ab" * 3, "edad: " + 5)', '3.5 3 1 1024 ababab edad: 5\n'],
  ['mostrar("hola".mayusculas(), dividir("a,b,c", ","), unir(["a","b"], "-"))', 'HOLA ["a", "b", "c"] a-b\n'],
  ['x = leer_numero("n: ")\nmostrar(x + 1)', 'n: Escribe un numero, por favor.\nn: 6\n', ['abc', '5']],
  ['mostrar(no falso y verdadero o falso, nulo)', 'verdadero nulo\n'],
];
let ok = 0;
for (const [src, expected, inputs] of cases) {
  try {
    assert.equal(exec(src, inputs), expected);
    ok++;
  } catch (e) {
    console.error('FALLO:\n' + src + '\n->', e.message);
    process.exitCode = 1;
  }
}
// Errores con numero de linea
for (const [src, line] of [['x = 1\nmostrar(y)', 2], ['l = [1]\n\nmostrar(l[5])', 3], ['si x', 1]]) {
  try { exec(src); console.error('FALLO: no dio error: ' + src); process.exitCode = 1; } catch (e) {
    if (!(e instanceof ChispaError) || e.line !== line) { console.error('FALLO linea:', src, e.message, e.line); process.exitCode = 1; } else ok++;
  }
}
console.log(`Chispa: ${ok} pruebas correctas`);
