/* Implementacion de la capa de compatibilidad (se enlaza con cada programa). */
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include "__compat.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Salida sin buffer: asi printf("Numero: ") aparece antes de scanf. */
__attribute__((constructor)) static void __cm_init(void) {
    setvbuf(stdout, NULL, _IONBF, 0);
}

static const int __cm_win2ansi[8] = {0, 4, 2, 6, 1, 5, 3, 7};

static int __cm_hex(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    c = (char)tolower((unsigned char)c);
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
}

int system(const char *cmd) {
    char buf[64];
    size_t i, n = 0;
    if (cmd == NULL) return 1;
    while (*cmd == ' ') cmd++;
    for (i = 0; cmd[i] && n < sizeof(buf) - 1; i++) buf[n++] = (char)tolower((unsigned char)cmd[i]);
    buf[n] = 0;
    if (strcmp(buf, "cls") == 0 || strcmp(buf, "clear") == 0) {
        printf("\033[2J\033[3J\033[H");
        return 0;
    }
    if (strncmp(buf, "pause", 5) == 0) {
        printf("Presione una tecla para continuar . . . ");
        __cm_getch();
        printf("\n");
        return 0;
    }
    if (strncmp(buf, "color", 5) == 0) {
        const char *a = buf + 5;
        while (*a == ' ') a++;
        if (strlen(a) >= 2) {
            int bg = __cm_hex(a[0]), fg = __cm_hex(a[1]);
            if (bg >= 0 && fg >= 0) {
                printf("\033[%d;%dm", (fg & 8 ? 90 : 30) + __cm_win2ansi[fg & 7],
                       (bg & 8 ? 100 : 40) + __cm_win2ansi[bg & 7]);
                printf("\033[2J\033[H");
            }
        } else {
            printf("\033[0m");
        }
        return 0;
    }
    if (strncmp(buf, "title", 5) == 0 || strncmp(buf, "chcp", 4) == 0 || strncmp(buf, "mode", 4) == 0)
        return 0;
    fprintf(stderr, "[system] comando no disponible en Android: %s\n", cmd);
    return 1;
}

#ifdef __cplusplus
}
#endif
