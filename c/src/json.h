#ifndef JSON_H
#define JSON_H

#include <stddef.h>

/* Минимальный разбор JSON: content/dishes.json читается один раз при запуске */
typedef enum { J_NULL, J_BOOL, J_NUM, J_STR, J_ARR, J_OBJ } JType;

typedef struct JVal {
    JType type;
    int b;
    double num;
    char *s;            /* J_STR, UTF-8 */
    struct JVal *items; /* J_ARR, J_OBJ */
    char **keys;        /* J_OBJ */
    size_t len;
} JVal;

/* Возвращает NULL при ошибке и пишет позицию ошибки в err */
JVal *json_parse(const char *text, char *err, size_t errlen);
const JVal *json_get(const JVal *obj, const char *key);
/* Строка поля или NULL, если поля нет или оно не строка */
const char *json_str(const JVal *obj, const char *key);

#endif
