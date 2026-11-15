# Código Móvil

App Android para **escribir y ejecutar código sin internet** desde el móvil.

| Lenguaje | Motor (dentro del APK) | Notas |
|---|---|---|
| **C** | clang/LLVM 22 compilado a WebAssembly | Compilador real. `stdio.h`, `stdlib.h`, `time.h`, `string.h`, `stdbool.h`, `math.h`… y tus propias cabeceras |
| **C++** | clang++ + libc++ | `iostream`, `string`, `vector`, `algorithm`, lambdas… (ver limitaciones) |
| **Python** | CPython 3.14 (Pyodide) | Biblioteca estándar completa |
| **Lua** | Lua 5.3 (Fengari) | `io.read`, `require` de otros archivos del proyecto |
| **JavaScript** | Motor de la WebView | `prompt()` lee de la terminal |
| **HTML + CSS + JS** | WebView | Vista previa y consola |
| **Chispa** | Intérprete propio | Lenguaje sencillo en español creado para la app ([guía](docs/CHISPA.md)) |
| Java, C# | — | Próxima versión (también offline) |

## Descargar el APK

* **Desde el móvil:** pestaña [Releases](../../releases) → *Código Móvil (última versión)* → `CodigoMovil.apk`
  (se publica automáticamente con cada cambio en `main`).
* **Desde una PR o rama:** pestaña *Actions* → ejecución de *Construir APK* → artefacto `CodigoMovil-apk`.

Al instalar, Android pedirá permiso para "instalar apps de origen desconocido".

## Cabeceras de Windows: `windows.h`, `rlutil.h`, `conio.h`

`windows.h` es parte del SDK de Windows y **no existe en Android**. La app incluye versiones de
compatibilidad (en [`web/src/compat`](web/src/compat)) que traducen lo que se usa en clase a
secuencias de terminal:

* `Sleep`, `Beep`, `GetTickCount`, `system("cls")`, `system("pause")`, `system("color 0A")`
* `SetConsoleTextAttribute`, `SetConsoleCursorPosition`, `GetStdHandle`, `COORD`, ocultar cursor
* `rlutil.h` con la misma API que el original: `setColor`, `cls`, `locate`, `gotoxy`, `getch`, `getkey`, `kbhit`, `msleep`…
* `conio.h`: `getch`, `kbhit`, `clrscr`, `textcolor`

Lo que depende de ventanas gráficas de Windows (CreateWindow, mensajes…) no se puede emular.

## Tus librerías (`llibreriaPropia.h`, `llibreriaExercici.h`)

Cada proyecto puede tener varios archivos. Importa tus `.h` y `.c` desde el menú
(**☰ → Importar archivos**) o créalos con **＋**. Al ejecutar se compilan todos los `.c` del
proyecto juntos, igual que en el PC.

Los archivos de texto del proyecto (`datos.txt`…) se pueden leer con `fopen`/`open()` y lo que el
programa escriba se guarda en el proyecto.

## Limitaciones conocidas

* C++: `try/catch` compila, pero si se lanza una excepción el programa se detiene mostrando cuál
  fue (la biblioteca estándar para WebAssembly no incluye el motor de excepciones).
* Sin hilos (`pthread`, `std::thread`) ni red.
* La primera ejecución de C/C++ o Python tarda unos segundos mientras se carga el compilador.

## Estructura

```
web/        Interfaz (editor + terminal) y motores. npm run build copia todo a android/.../assets/www
  src/js/chispa.js     Intérprete de Chispa
  src/js/wasi.js       WASI mínimo para ejecutar los programas C/C++ compilados
  src/compat/          windows.h, rlutil.h, conio.h de compatibilidad
  test/                Pruebas (npm test)
android/    App Android (WebView, sin dependencias)
```

### Compilar en local

```bash
cd web && npm ci && npm run build && npm test
cd ../android && ./gradlew assembleRelease   # requiere Android SDK
```

Para probar la interfaz en el navegador: `cd web && npm run build -- ../dist && node scripts/serve.mjs ../dist`.

### Firma propia (opcional)

Por defecto el APK se firma con una clave de depuración que se conserva en la caché de GitHub
Actions. Para usar una clave fija, añade estos secretos al repositorio: `KEYSTORE_BASE64`
(el `.jks` en base64), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
