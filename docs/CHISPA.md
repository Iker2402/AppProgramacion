# Chispa

Chispa es un lenguaje pequeño, en español, pensado para practicar lógica de programación y
luego saltar a C, Python o JavaScript. Su intérprete completo está en
[`web/src/js/chispa.js`](../web/src/js/chispa.js) (unas 800 líneas comentadas): puedes leerlo y
ampliarlo, por ejemplo añadiendo una función nueva al objeto `B` o una palabra clave al parser.

En la app: **☰ → Ejemplos → Chispa: guía completa del lenguaje**.

## Lo básico

```
# Comentario
nombre = leer("¿Cómo te llamas? ")
edad = leer_numero("¿Edad? ")
mostrar("Hola", nombre)                 # separa con espacios
mostrar($"El año que viene tendrás {edad + 1}")
escribir("sin salto de línea")
```

## Tipos

`numero` (`3`, `2.5`), `texto` (`"hola"`), `logico` (`verdadero`, `falso`), `nulo`,
`lista` (`[1, 2, 3]`), `diccionario` (`{nombre: "Iker", edad: 20}`), `funcion`, `clase`.

## Operadores

`+ - * / // % ^` (`//` división entera, `^` potencia), `== != < <= > >=`, `y o no`,
`+= -= *= /=`. `"texto" + 5` concatena. `"ja" * 3` repite.

## Control de flujo

```
si nota >= 5 entonces
  mostrar("Aprobado")
sino si nota >= 4 entonces
  mostrar("Casi")
sino
  mostrar("Suspendido")
fin

mientras x < 10 hacer x += 1 fin
para i desde 1 hasta 10 hacer ... fin
para i desde 10 hasta 0 paso -2 hacer ... fin
para elemento en lista hacer ... fin
repetir 3 veces ... fin
romper / continuar
```

`entonces` y `hacer` son opcionales.

## Funciones y clases

```
funcion area(base, altura)
  retornar base * altura
fin
doble = funcion(x) retornar x * 2 fin

clase Cuenta
  funcion iniciar(titular)
    yo.titular = titular
    yo.saldo = 0
  fin
  funcion ingresar(c) yo.saldo += c fin
fin
c = Cuenta("Iker")
c.ingresar(10)
```

## Errores

```
intentar
  error("algo ha ido mal")
capturar e
  mostrar("Error:", e)
fin
```

## Funciones incluidas

* Entrada/salida: `mostrar`, `escribir`, `leer`, `leer_numero`, `limpiar`, `color("rojo")`, `posicion(x, y)`, `esperar(seg)`, `tecla()`, `hay_tecla()`
* Conversión: `numero`, `entero`, `texto`, `tipo`
* Listas: `longitud`, `agregar`, `insertar`, `quitar`, `ordenar`, `invertir`, `contiene`, `indice`, `suma`, `maximo`, `minimo`, `rango`, `mapa`, `filtrar`, `reducir`, `copiar`
* Diccionarios: `claves`, `valores`, `contiene`, `quitar`
* Texto: `mayusculas`, `minusculas`, `recortar`, `dividir`, `unir`, `reemplazar`, `subtexto`, `empieza`, `termina`, `caracter`, `codigo`
* Matemáticas: `abs`, `raiz`, `potencia`, `redondear`, `piso`, `techo`, `seno`, `coseno`, `PI`, `aleatorio(a, b)`
* Otros: `tiempo()`, `fecha()`, `error(msg)`, `afirmar(cond, msg)`

Cualquier función se puede usar como método: `lista.agregar(3)` es lo mismo que
`agregar(lista, 3)`, y `nombre.mayusculas()` lo mismo que `mayusculas(nombre)`.
