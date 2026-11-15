/* rlutil.h de compatibilidad para Codigo Movil.
 *
 * Misma API que rlutil (https://github.com/tapio/rlutil): colores, cls, locate,
 * gotoxy, getch, kbhit, getkey, msleep, hidecursor... implementada con
 * secuencias ANSI sobre la terminal de la app. Funciona en C y en C++
 * (en C++ las funciones estan en el namespace rlutil, como en el original). */
#ifndef RLUTIL_H
#define RLUTIL_H
#include <stdio.h>
#include "__compat.h"

#ifdef __cplusplus
#include <string>
#include <iostream>
#define RLUTIL_NS_BEGIN namespace rlutil {
#define RLUTIL_NS_END }
#define RLUTIL_INLINE inline
#else
#include <stdbool.h>
#define RLUTIL_NS_BEGIN
#define RLUTIL_NS_END
#define RLUTIL_INLINE static inline
#endif

/* getch / kbhit son globales (igual que en rlutil en Linux). */
#ifndef CM_HAVE_GETCH
#define CM_HAVE_GETCH
RLUTIL_INLINE int getch(void) { fflush(stdout); return __cm_getch(); }
RLUTIL_INLINE int kbhit(void) { return __cm_kbhit(); }
#endif
RLUTIL_INLINE void gotoxy(int x, int y) { printf("\033[%d;%dH", y, x); }

RLUTIL_NS_BEGIN

enum {
    BLACK, BLUE, GREEN, CYAN, RED, MAGENTA, BROWN, GREY,
    DARKGREY, LIGHTBLUE, LIGHTGREEN, LIGHTCYAN, LIGHTRED, LIGHTMAGENTA, YELLOW, WHITE
};

enum {
    KEY_ESCAPE = 0, KEY_ENTER = 1, KEY_SPACE = 32,
    KEY_INSERT = 2, KEY_HOME = 3, KEY_PGUP = 4, KEY_DELETE = 5, KEY_END = 6, KEY_PGDOWN = 7,
    KEY_UP = 14, KEY_DOWN = 15, KEY_LEFT = 16, KEY_RIGHT = 17,
    KEY_F1 = 18, KEY_F2 = 19, KEY_F3 = 20, KEY_F4 = 21, KEY_F5 = 22, KEY_F6 = 23,
    KEY_F7 = 24, KEY_F8 = 25, KEY_F9 = 26, KEY_F10 = 27, KEY_F11 = 28, KEY_F12 = 29,
    KEY_NUMDEL = 30, KEY_NUMPAD0 = 31, KEY_NUMPAD1 = 32, KEY_NUMPAD2 = 33, KEY_NUMPAD3 = 34,
    KEY_NUMPAD4 = 35, KEY_NUMPAD5 = 36, KEY_NUMPAD6 = 37, KEY_NUMPAD7 = 38, KEY_NUMPAD8 = 39,
    KEY_NUMPAD9 = 40
};

RLUTIL_INLINE const char *getANSIColor(int c) {
    static const char *t[16] = {
        "\033[22;30m", "\033[22;34m", "\033[22;32m", "\033[22;36m", "\033[22;31m", "\033[22;35m",
        "\033[22;33m", "\033[22;37m", "\033[01;30m", "\033[01;34m", "\033[01;32m", "\033[01;36m",
        "\033[01;31m", "\033[01;35m", "\033[01;33m", "\033[01;37m"};
    return (c >= 0 && c < 16) ? t[c] : "";
}
RLUTIL_INLINE const char *getANSIBackgroundColor(int c) {
    static const char *t[16] = {
        "\033[40m", "\033[44m", "\033[42m", "\033[46m", "\033[41m", "\033[45m", "\033[43m", "\033[47m",
        "\033[100m", "\033[104m", "\033[102m", "\033[106m", "\033[101m", "\033[105m", "\033[103m", "\033[107m"};
    return (c >= 0 && c < 16) ? t[c] : "";
}
RLUTIL_INLINE void setColor(int c) { printf("%s", getANSIColor(c)); }
RLUTIL_INLINE void setBackgroundColor(int c) { printf("%s", getANSIBackgroundColor(c)); }
RLUTIL_INLINE int saveDefaultColor(void) { return 7; }
RLUTIL_INLINE void resetColor(void) { printf("\033[0m"); }
RLUTIL_INLINE void cls(void) { printf("\033[2J\033[H"); }
RLUTIL_INLINE void locate(int x, int y) { printf("\033[%d;%dH", y, x); }
RLUTIL_INLINE void setChar(char ch) { printf("%c", ch); }
RLUTIL_INLINE void setCursorVisibility(char visible) { printf(visible ? "\033[?25h" : "\033[?25l"); }
RLUTIL_INLINE void hidecursor(void) { setCursorVisibility(0); }
RLUTIL_INLINE void showcursor(void) { setCursorVisibility(1); }
RLUTIL_INLINE void msleep(unsigned int ms) { fflush(stdout); __cm_sleep_ms((int)ms); }
RLUTIL_INLINE int trows(void) { return __cm_rows(); }
RLUTIL_INLINE int tcols(void) { return __cm_cols(); }
RLUTIL_INLINE int nb_getch(void) { return kbhit() ? getch() : 0; }

/* getkey: traduce flechas y teclas especiales a los codigos KEY_* de rlutil. */
RLUTIL_INLINE int getkey(void) {
    int k = getch();
    if (k == 0 || k == 224) {
        int k2 = getch();
        switch (k2) {
            case 72: return KEY_UP;
            case 80: return KEY_DOWN;
            case 75: return KEY_LEFT;
            case 77: return KEY_RIGHT;
            case 71: return KEY_HOME;
            case 79: return KEY_END;
            case 73: return KEY_PGUP;
            case 81: return KEY_PGDOWN;
            case 82: return KEY_INSERT;
            case 83: return KEY_DELETE;
            default: if (k2 >= 59 && k2 <= 68) return KEY_F1 + (k2 - 59); return k2;
        }
    }
    if (k == 27) return KEY_ESCAPE;
    if (k == 13 || k == 10) return KEY_ENTER;
    return k;
}

#ifdef __cplusplus
inline void setString(const std::string &s) { std::cout << s << std::flush; }
inline void anykey(const std::string &msg = "") { if (!msg.empty()) std::cout << msg << std::flush; getch(); }
inline void setConsoleTitle(const std::string &t) { (void)t; }
struct CursorHider { CursorHider() { hidecursor(); } ~CursorHider() { showcursor(); } };
#else
RLUTIL_INLINE void setString(const char *s) { printf("%s", s); }
RLUTIL_INLINE void anykey(const char *msg) { if (msg) printf("%s", msg); getch(); }
RLUTIL_INLINE void setConsoleTitle(const char *t) { (void)t; }
#endif

RLUTIL_NS_END

#ifdef __cplusplus
/* Comodidad: tambien accesibles sin "rlutil::". */
using namespace rlutil;
#endif

#endif
