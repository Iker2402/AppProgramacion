/* conio.h de compatibilidad (Turbo C / MinGW) para Codigo Movil. */
#ifndef CODIGO_MOVIL_CONIO_H
#define CODIGO_MOVIL_CONIO_H
#include <stdio.h>
#include "__compat.h"
#ifndef CM_HAVE_GETCH
#define CM_HAVE_GETCH
static inline int getch(void) { fflush(stdout); return __cm_getch(); }
static inline int kbhit(void) { return __cm_kbhit(); }
#endif
static inline int _getch(void) { return getch(); }
static inline int getche(void) { int c = getch(); putchar(c); return c; }
static inline int _getche(void) { return getche(); }
static inline int _kbhit(void) { return kbhit(); }
static inline void clrscr(void) { printf("\033[2J\033[H"); }
static inline void textcolor(int c) {
    static const int map[8] = {0, 4, 2, 6, 1, 5, 3, 7};
    printf("\033[%dm", (c & 8 ? 90 : 30) + map[c & 7]);
}
static inline void textbackground(int c) {
    static const int map[8] = {0, 4, 2, 6, 1, 5, 3, 7};
    printf("\033[%dm", (c & 8 ? 100 : 40) + map[c & 7]);
}
#endif
