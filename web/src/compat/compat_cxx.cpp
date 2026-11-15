// Soporte minimo de excepciones de C++ para Codigo Movil.
//
// La biblioteca estandar incluida (libc++ para WebAssembly) no trae el motor de
// excepciones. Tu codigo con try/catch compila y funciona mientras no se lance
// ninguna excepcion; si se lanza una (throw, vector::at fuera de rango...),
// el programa se detiene mostrando que excepcion fue y su mensaje.
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <typeinfo>

extern "C" char *__cxa_demangle(const char *, char *, size_t *, int *);

extern "C" void *__cxa_allocate_exception(size_t n) noexcept {
    void *p = calloc(1, n ? n : 1);
    if (!p) abort();
    return p;
}

extern "C" void __cxa_free_exception(void *p) noexcept { free(p); }

static bool cm_is_std_exception(const char *name) {
    static const char *known[] = {
        "std::exception", "std::logic_error", "std::runtime_error", "std::out_of_range",
        "std::invalid_argument", "std::length_error", "std::domain_error", "std::overflow_error",
        "std::underflow_error", "std::range_error", "std::bad_alloc", "std::bad_cast",
        "std::bad_array_new_length", "std::bad_function_call", "std::bad_optional_access",
        "std::bad_variant_access", "std::__1::out_of_range", "std::__1::invalid_argument",
        "std::__1::length_error", "std::__1::bad_function_call", "std::__1::bad_optional_access",
        "std::__1::bad_variant_access", nullptr};
    for (int i = 0; known[i]; i++)
        if (strcmp(name, known[i]) == 0) return true;
    return false;
}

extern "C" [[noreturn]] void __cxa_throw(void *obj, std::type_info *tinfo, void (*)(void *)) {
    fflush(stdout);
    const char *mangled = tinfo ? tinfo->name() : "?";
    int status = 0;
    char *name = __cxa_demangle(mangled, nullptr, nullptr, &status);
    const char *shown = (status == 0 && name) ? name : mangled;
    fprintf(stderr, "\n\033[31mExcepcion no capturada: %s", shown);
    if (cm_is_std_exception(shown)) fprintf(stderr, ": %s", static_cast<std::exception *>(obj)->what());
    else if (strcmp(shown, "char const*") == 0 || strcmp(shown, "const char*") == 0) fprintf(stderr, ": %s", *static_cast<const char **>(obj));
    else if (strcmp(shown, "int") == 0) fprintf(stderr, ": %d", *static_cast<int *>(obj));
    fprintf(stderr, "\n(En esta version las excepciones detienen el programa; catch todavia no las captura.)\033[0m\n");
    exit(134);
}
