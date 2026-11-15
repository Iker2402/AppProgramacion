// Lenguajes disponibles y plantillas de proyecto.

export const LANGS = {
  c: { name: 'C', main: 'main.c', mode: 'text/x-csrc' },
  cpp: { name: 'C++', main: 'main.cpp', mode: 'text/x-c++src' },
  python: { name: 'Python', main: 'main.py', mode: 'python' },
  lua: { name: 'Lua', main: 'main.lua', mode: 'lua' },
  javascript: { name: 'JavaScript (consola)', main: 'main.js', mode: 'javascript' },
  web: { name: 'Web: HTML + CSS + JS', main: 'index.html', mode: 'htmlmixed' },
  chispa: { name: 'Chispa', main: 'main.chispa', mode: 'chispa' },
  java: { name: 'Java', main: 'Main.java', mode: 'text/x-java', soon: true },
  csharp: { name: 'C#', main: 'Program.cs', mode: 'text/x-csharp', soon: true },
};

export function modeForFile(name, lang) {
  const ext = (name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  switch (ext) {
    case 'c': return 'text/x-csrc';
    case 'h': return lang === 'cpp' ? 'text/x-c++src' : 'text/x-csrc';
    case 'cpp': case 'cc': case 'cxx': case 'hpp': case 'hh': return 'text/x-c++src';
    case 'py': return 'python';
    case 'lua': return 'lua';
    case 'js': case 'mjs': return 'javascript';
    case 'json': return { name: 'javascript', json: true };
    case 'html': case 'htm': return 'htmlmixed';
    case 'css': return 'css';
    case 'chispa': case 'chs': return 'chispa';
    case 'java': return 'text/x-java';
    case 'cs': return 'text/x-csharp';
    default: return null;
  }
}

const C_MAIN = `#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <windows.h>
#include <string.h>
#include <stdbool.h>
#include "rlutil.h"
#include "llibreriaPropia.h"
#include "llibreriaExercici.h"

int main() {
    char nom[50];
    int numero, intents = 0;
    bool encertat = false;

    srand(time(NULL));
    int secret = rand() % 100 + 1;

    system("cls");
    setColor(YELLOW);
    printf("=== Endevina el numero ===\\n");
    resetColor();

    printf("Com et dius? ");
    scanf("%49s", nom);
    saludar(nom);

    while (!encertat) {
        printf("Numero (1-100): ");
        if (scanf("%d", &numero) != 1) break;
        intents++;
        if (numero == secret) {
            encertat = true;
        } else {
            setColor(numero < secret ? LIGHTBLUE : LIGHTRED);
            printf(numero < secret ? "Mes gran!\\n" : "Mes petit!\\n");
            resetColor();
        }
    }

    setColor(LIGHTGREEN);
    printf("Correcte en %d intents! Puntuacio: %d\\n", intents, puntuacio(intents));
    resetColor();
    Sleep(500);
    system("pause");
    return 0;
}
`;

const C_PROPIA_H = `#ifndef LLIBRERIA_PROPIA_H
#define LLIBRERIA_PROPIA_H
/* Substitueix aquest fitxer pel teu llibreriaPropia.h
 * (menu > Importar arxius) o enganxa-hi el teu codi. */
#include <stdio.h>

void saludar(const char *nom);

#endif
`;

const C_PROPIA_C = `#include "llibreriaPropia.h"

void saludar(const char *nom) {
    printf("Hola, %s!\\n", nom);
}
`;

const C_EXERCICI_H = `#ifndef LLIBRERIA_EXERCICI_H
#define LLIBRERIA_EXERCICI_H
/* Substitueix aquest fitxer pel teu llibreriaExercici.h */

int puntuacio(int intents);

#endif
`;

const C_EXERCICI_C = `#include "llibreriaExercici.h"

int puntuacio(int intents) {
    int p = 110 - intents * 10;
    return p < 10 ? 10 : p;
}
`;

export const TEMPLATES = {
  c: () => ({
    'main.c': C_MAIN,
    'llibreriaPropia.h': C_PROPIA_H,
    'llibreriaPropia.c': C_PROPIA_C,
    'llibreriaExercici.h': C_EXERCICI_H,
    'llibreriaExercici.c': C_EXERCICI_C,
  }),
  cpp: () => ({
    'main.cpp': `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;

struct Alumne {
    string nom;
    double nota;
};

int main() {
    vector<Alumne> alumnes;
    int n;
    cout << "Quants alumnes? ";
    cin >> n;
    for (int i = 0; i < n; i++) {
        Alumne a;
        cout << "Nom: ";
        cin >> a.nom;
        cout << "Nota: ";
        cin >> a.nota;
        alumnes.push_back(a);
    }
    sort(alumnes.begin(), alumnes.end(), [](const Alumne &a, const Alumne &b) { return a.nota > b.nota; });
    cout << "\\nRanking:" << endl;
    for (const auto &a : alumnes) cout << "  " << a.nom << ": " << a.nota << endl;
    return 0;
}
`,
  }),
  python: () => ({
    'main.py': `import random
import time

def tirar_dados(n):
    return [random.randint(1, 6) for _ in range(n)]

nombre = input("¿Cómo te llamas? ")
print(f"Hola, {nombre}! Vamos a tirar dados.")
n = int(input("¿Cuántos dados? "))
for i in range(3):
    print("Tirando...", end=" ")
    time.sleep(0.5)
    tirada = tirar_dados(n)
    print(tirada, "suma =", sum(tirada))
`,
  }),
  lua: () => ({
    'main.lua': `-- Lua: tablas, funciones y bucles
local function fibonacci(n)
  local a, b = 0, 1
  local t = {}
  for i = 1, n do
    t[#t + 1] = a
    a, b = b, a + b
  end
  return t
end

io.write("¿Cuántos números de Fibonacci? ")
local n = tonumber(io.read())
print(table.concat(fibonacci(n or 10), ", "))

local persona = { nombre = "Iker", lenguajes = { "C", "Python", "Lua" } }
for i, l in ipairs(persona.lenguajes) do
  print(i, l)
end
`,
  }),
  javascript: () => ({
    'main.js': `// JavaScript de consola. prompt() lee de la terminal.
const nombre = prompt("¿Cómo te llamas? ");
console.log(\`Hola, \${nombre}!\`);

const numeros = Array.from({ length: 10 }, (_, i) => i + 1);
console.log("Pares:", numeros.filter(n => n % 2 === 0));
console.log("Cuadrados:", numeros.map(n => n * n));

class Contador {
  constructor() { this.valor = 0; }
  sumar() { this.valor++; return this; }
}
console.log(new Contador().sumar().sumar().valor);
`,
  }),
  web: () => ({
    'index.html': `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Mi página</h1>
  <p>Has pulsado <span id="n">0</span> veces.</p>
  <button id="btn">¡Púlsame!</button>
  <script src="app.js"></script>
</body>
</html>
`,
    'style.css': `body {
  font-family: sans-serif;
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  color: white;
  text-align: center;
  padding: 40px 16px;
}
button {
  font-size: 20px;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  background: #ffb020;
}
`,
    'app.js': `let n = 0;
document.getElementById('btn').addEventListener('click', () => {
  n++;
  document.getElementById('n').textContent = n;
  console.log('Clic número', n);
});
`,
  }),
  chispa: () => ({
    'main.chispa': `# Bienvenido a Chispa: un lenguaje sencillo en español.
# Pulsa ▶ para ejecutar. Abre "Ejemplos > Guía de Chispa" para aprender más.

nombre = leer("¿Cómo te llamas? ")
mostrar($"¡Hola, {nombre}!")

funcion es_primo(n)
  si n < 2 entonces retornar falso fin
  para d desde 2 hasta raiz(n) hacer
    si n % d == 0 entonces retornar falso fin
  fin
  retornar verdadero
fin

primos = filtrar(rango(1, 50), es_primo)
mostrar("Primos hasta 50:", primos)

color("verde")
mostrar("¡Ya sabes usar funciones y listas!")
color("normal")
`,
  }),
  java: () => ({
    'Main.java': `public class Main {
    public static void main(String[] args) {
        System.out.println("Hola desde Java");
    }
}
`,
  }),
  csharp: () => ({
    'Program.cs': `using System;

class Program {
    static void Main() {
        Console.WriteLine("Hola desde C#");
    }
}
`,
  }),
};

const CHISPA_GUIDE = `# ============================================
#  GUÍA DE CHISPA (ejecuta y lee los comentarios)
# ============================================

# --- 1. Mostrar y leer ---
mostrar("Hola", "mundo", 2026)      # separa con espacios y salta de línea
escribir("sin salto ")              # no salta de línea
escribir("de línea\\n")
# nombre = leer("Tu nombre: ")      # lee texto
# edad = leer_numero("Tu edad: ")   # lee un número

# --- 2. Variables y tipos ---
entero = 42
decimal = 3.14
texto = "Chispa"
logico = verdadero                  # verdadero / falso
nada = nulo
mostrar(tipo(entero), tipo(texto), tipo(logico), tipo(nada))

# --- 3. Operadores ---
mostrar(7 + 2, 7 - 2, 7 * 2, 7 / 2, 7 // 2, 7 % 2, 2 ^ 8)
mostrar("ja" * 3, "Edad: " + 20)
mostrar(5 > 3 y 2 > 1, no verdadero, falso o verdadero)

# --- 4. Texto con variables ($"...") ---
lenguaje = "C"
mostrar($"Estoy aprendiendo {lenguaje} y {texto}. 2+2={2 + 2}")

# --- 5. Condiciones ---
nota = 7.5
si nota >= 9 entonces
  mostrar("Excelente")
sino si nota >= 5 entonces
  mostrar("Aprobado")
sino
  mostrar("Suspendido")
fin

# --- 6. Bucles ---
para i desde 1 hasta 5 hacer escribir(i, " ") fin
mostrar("")
para i desde 10 hasta 0 paso -2 hacer escribir(i, " ") fin
mostrar("")
repetir 3 veces escribir("¡hip! ") fin
mostrar("")
contador = 0
mientras contador < 3 hacer
  contador += 1
fin
mostrar("contador =", contador)

# --- 7. Listas (empiezan en 0) ---
frutas = ["manzana", "pera"]
frutas.agregar("kiwi")              # igual que agregar(frutas, "kiwi")
mostrar(frutas, longitud(frutas), frutas[0], frutas[-1])
para f en frutas hacer mostrar("-", f.mayusculas()) fin
mostrar(ordenar([5, 2, 8, 1]), suma([1, 2, 3]), maximo(4, 9, 2))

# --- 8. Diccionarios ---
alumno = {nombre: "Iker", nota: 8}
alumno["curso"] = "DAM"
mostrar(alumno.nombre, alumno["nota"], claves(alumno))

# --- 9. Funciones ---
funcion area_rectangulo(base, altura)
  retornar base * altura
fin
mostrar("Área:", area_rectangulo(3, 4))
doble = funcion(x) retornar x * 2 fin   # función anónima
mostrar(mapa([1, 2, 3], doble))

# --- 10. Clases ---
clase Cuenta
  funcion iniciar(titular)
    yo.titular = titular
    yo.saldo = 0
  fin
  funcion ingresar(cantidad)
    yo.saldo += cantidad
    retornar yo
  fin
fin
c = Cuenta("Iker")
c.ingresar(50).ingresar(25)
mostrar(c.titular, "tiene", c.saldo, "€")

# --- 11. Errores ---
intentar
  x = [1, 2, 3]
  mostrar(x[10])
capturar e
  mostrar("Error capturado:", e)
fin

# --- 12. Consola: colores, esperar, aleatorio ---
color("cian")
mostrar("Número aleatorio del 1 al 6:", aleatorio(1, 6))
color("normal")
esperar(0.5)
mostrar("¡Fin de la guía!")
`;

export const EXAMPLES = [
  { id: 'c-clase', lang: 'c', name: 'C: endevina el número (rlutil + windows.h)', files: TEMPLATES.c },
  {
    id: 'c-menu', lang: 'c', name: 'C: menú con structs y ficheros', files: () => ({
      'main.c': `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <windows.h>

#define MAX 20

typedef struct {
    char nom[30];
    int edat;
} Persona;

int carregar(Persona v[]) {
    FILE *f = fopen("persones.txt", "r");
    int n = 0;
    if (f == NULL) return 0;
    while (n < MAX && fscanf(f, "%29s %d", v[n].nom, &v[n].edat) == 2) n++;
    fclose(f);
    return n;
}

void guardar(Persona v[], int n) {
    FILE *f = fopen("persones.txt", "w");
    for (int i = 0; i < n; i++) fprintf(f, "%s %d\\n", v[i].nom, v[i].edat);
    fclose(f);
}

int main() {
    Persona v[MAX];
    int n = carregar(v), op;
    bool sortir = false;
    while (!sortir) {
        printf("\\n1) Llistar  2) Afegir  3) Sortir\\nOpcio: ");
        if (scanf("%d", &op) != 1) break;
        switch (op) {
            case 1:
                system("cls");
                for (int i = 0; i < n; i++) printf("%d. %s (%d anys)\\n", i + 1, v[i].nom, v[i].edat);
                break;
            case 2:
                if (n == MAX) { printf("Ple!\\n"); break; }
                printf("Nom: "); scanf("%29s", v[n].nom);
                printf("Edat: "); scanf("%d", &v[n].edat);
                n++;
                guardar(v, n);
                printf("Desat a persones.txt\\n");
                break;
            default:
                sortir = true;
        }
    }
    return 0;
}
`,
      'persones.txt': 'Anna 20\nMarc 22\n',
    }),
  },
  {
    id: 'c-anim', lang: 'c', name: 'C: animación con colores y gotoxy', files: () => ({
      'main.c': `#include <stdio.h>
#include "rlutil.h"

int main() {
    hidecursor();
    cls();
    for (int x = 1; x <= 30; x++) {
        locate(x, 5);
        setColor(x % 15 + 1);
        printf(" O");
        fflush(stdout);
        msleep(60);
    }
    resetColor();
    showcursor();
    locate(1, 8);
    printf("Pulsa una tecla...\\n");
    int k = getkey();
    printf("Has pulsado el codigo %d\\n", k);
    return 0;
}
`,
    }),
  },
  { id: 'cpp-ranking', lang: 'cpp', name: 'C++: vector, string y sort', files: TEMPLATES.cpp },
  { id: 'py-dados', lang: 'python', name: 'Python: dados', files: TEMPLATES.python },
  { id: 'lua-fib', lang: 'lua', name: 'Lua: Fibonacci y tablas', files: TEMPLATES.lua },
  { id: 'js-basico', lang: 'javascript', name: 'JavaScript: consola', files: TEMPLATES.javascript },
  { id: 'web-contador', lang: 'web', name: 'Web: página con botón', files: TEMPLATES.web },
  { id: 'chispa-guia', lang: 'chispa', name: 'Chispa: guía completa del lenguaje', files: () => ({ 'guia.chispa': CHISPA_GUIDE }), main: 'guia.chispa' },
  {
    id: 'chispa-juego', lang: 'chispa', name: 'Chispa: juego de adivinar', files: () => ({
      'main.chispa': `secreto = aleatorio(1, 100)
intentos = 0
limpiar()
color("amarillo")
mostrar("=== Adivina el número (1-100) ===")
color("normal")
mientras verdadero hacer
  n = leer_numero("Tu número: ")
  intentos += 1
  si n == secreto entonces
    color("verde")
    mostrar($"¡Correcto en {intentos} intentos!")
    color("normal")
    romper
  sino si n < secreto entonces
    mostrar("Más grande")
  sino
    mostrar("Más pequeño")
  fin
fin
`,
    }),
  },
];
