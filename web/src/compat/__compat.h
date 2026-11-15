/* Cabecera de compatibilidad incluida automaticamente en cada programa C/C++.
 * Declara funciones que en Android/WebAssembly no existen de serie
 * (system, Sleep...) para que el codigo escrito para Windows compile igual. */
#ifndef CODIGO_MOVIL_COMPAT_H
#define CODIGO_MOVIL_COMPAT_H
#ifdef __cplusplus
extern "C" {
#endif
/* Puente con la app (implementado en JavaScript). */
__attribute__((import_module("compat"), import_name("getch"))) int __cm_getch(void);
__attribute__((import_module("compat"), import_name("kbhit"))) int __cm_kbhit(void);
__attribute__((import_module("compat"), import_name("sleep_ms"))) void __cm_sleep_ms(int ms);
__attribute__((import_module("compat"), import_name("term_cols"))) int __cm_cols(void);
__attribute__((import_module("compat"), import_name("term_rows"))) int __cm_rows(void);
/* system("cls"), system("pause"), system("color 0A")... emulados. */
int system(const char *command);
#ifdef __cplusplus
}
#endif
#endif
