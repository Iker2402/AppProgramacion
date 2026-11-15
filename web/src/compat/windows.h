/* windows.h de compatibilidad para Codigo Movil.
 *
 * El windows.h real es parte del SDK de Windows y no existe en Android.
 * Esta version implementa lo que se usa en programas de consola de clase:
 * Sleep, Beep, colores (SetConsoleTextAttribute), posicion del cursor
 * (SetConsoleCursorPosition / gotoxy), ocultar cursor, GetTickCount...
 * Todo se traduce a secuencias ANSI que entiende la terminal de la app. */
#ifndef CODIGO_MOVIL_WINDOWS_H
#define CODIGO_MOVIL_WINDOWS_H
#include <stdio.h>
#include <time.h>
#include "__compat.h"

typedef int BOOL;
typedef unsigned char BYTE;
typedef unsigned short WORD;
typedef unsigned long DWORD;
typedef long LONG;
typedef unsigned int UINT;
typedef short SHORT;
typedef char CHAR;
typedef const char *LPCSTR;
typedef const char *LPCTSTR;
typedef char *LPSTR;
typedef void *HANDLE;
typedef void *HWND;
typedef DWORD *LPDWORD;
#ifndef TRUE
#define TRUE 1
#endif
#ifndef FALSE
#define FALSE 0
#endif
#define WINAPI
#define STD_INPUT_HANDLE ((DWORD)-10)
#define STD_OUTPUT_HANDLE ((DWORD)-11)
#define STD_ERROR_HANDLE ((DWORD)-12)
#define INVALID_HANDLE_VALUE ((HANDLE)(long)-1)
#define CP_UTF8 65001

#define FOREGROUND_BLUE 0x0001
#define FOREGROUND_GREEN 0x0002
#define FOREGROUND_RED 0x0004
#define FOREGROUND_INTENSITY 0x0008
#define BACKGROUND_BLUE 0x0010
#define BACKGROUND_GREEN 0x0020
#define BACKGROUND_RED 0x0040
#define BACKGROUND_INTENSITY 0x0080

#define VK_ESCAPE 0x1B
#define VK_RETURN 0x0D
#define VK_SPACE 0x20
#define VK_LEFT 0x25
#define VK_UP 0x26
#define VK_RIGHT 0x27
#define VK_DOWN 0x28

typedef struct _COORD { SHORT X; SHORT Y; } COORD;
typedef struct _SMALL_RECT { SHORT Left; SHORT Top; SHORT Right; SHORT Bottom; } SMALL_RECT;
typedef struct _CONSOLE_CURSOR_INFO { DWORD dwSize; BOOL bVisible; } CONSOLE_CURSOR_INFO;
typedef struct _CONSOLE_SCREEN_BUFFER_INFO {
    COORD dwSize; COORD dwCursorPosition; WORD wAttributes;
    SMALL_RECT srWindow; COORD dwMaximumWindowSize;
} CONSOLE_SCREEN_BUFFER_INFO;

static inline HANDLE GetStdHandle(DWORD n) { return (HANDLE)(unsigned long)n; }
static inline void Sleep(DWORD ms) { fflush(stdout); __cm_sleep_ms((int)ms); }
static inline BOOL Beep(DWORD freq, DWORD ms) { (void)freq; printf("\a"); Sleep(ms); return TRUE; }
static inline DWORD GetTickCount(void) { return (DWORD)(clock() * 1000.0 / CLOCKS_PER_SEC); }

static inline BOOL SetConsoleTextAttribute(HANDLE h, WORD attr) {
    static const int map[8] = {0, 4, 2, 6, 1, 5, 3, 7};
    int fg = attr & 0x0F, bg = (attr >> 4) & 0x0F;
    (void)h;
    printf("\033[0;%d;%dm", (fg & 8 ? 90 : 30) + map[fg & 7], (bg & 8 ? 100 : 40) + map[bg & 7]);
    return TRUE;
}
static inline BOOL SetConsoleCursorPosition(HANDLE h, COORD c) {
    (void)h;
    printf("\033[%d;%dH", c.Y + 1, c.X + 1);
    return TRUE;
}
static inline BOOL SetConsoleCursorInfo(HANDLE h, const CONSOLE_CURSOR_INFO *ci) {
    (void)h;
    printf(ci && ci->bVisible ? "\033[?25h" : "\033[?25l");
    return TRUE;
}
static inline BOOL GetConsoleCursorInfo(HANDLE h, CONSOLE_CURSOR_INFO *ci) {
    (void)h; if (ci) { ci->dwSize = 25; ci->bVisible = TRUE; } return TRUE;
}
static inline BOOL GetConsoleScreenBufferInfo(HANDLE h, CONSOLE_SCREEN_BUFFER_INFO *i) {
    (void)h;
    if (!i) return FALSE;
    i->dwSize.X = (SHORT)__cm_cols(); i->dwSize.Y = (SHORT)__cm_rows();
    i->dwCursorPosition.X = 0; i->dwCursorPosition.Y = 0; i->wAttributes = 7;
    i->srWindow.Left = 0; i->srWindow.Top = 0;
    i->srWindow.Right = (SHORT)(__cm_cols() - 1); i->srWindow.Bottom = (SHORT)(__cm_rows() - 1);
    i->dwMaximumWindowSize = i->dwSize;
    return TRUE;
}
static inline BOOL SetConsoleTitleA(LPCSTR t) { (void)t; return TRUE; }
#define SetConsoleTitle SetConsoleTitleA
static inline BOOL SetConsoleOutputCP(UINT cp) { (void)cp; return TRUE; }
static inline BOOL SetConsoleCP(UINT cp) { (void)cp; return TRUE; }
static inline SHORT GetAsyncKeyState(int vk) { (void)vk; return 0; }
static inline SHORT GetKeyState(int vk) { (void)vk; return 0; }
static inline HWND GetConsoleWindow(void) { return (HWND)0; }
static inline int MessageBoxA(HWND w, LPCSTR text, LPCSTR title, UINT type) {
    (void)w; (void)type;
    printf("\n[%s] %s\n", title ? title : "Mensaje", text ? text : "");
    return 1;
}
#define MessageBox MessageBoxA
#define MB_OK 0

#endif
