#include "json.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const char *p;
    const char *start;
    int depth;
    char *err;
    size_t errlen;
} P;

static void *xrealloc(void *p, size_t n) {
    void *r = realloc(p, n ? n : 1);
    if (!r) {
        fputs("Не хватает памяти\n", stderr);
        exit(1);
    }
    return r;
}

static int fail(P *ps, const char *msg) {
    snprintf(ps->err, ps->errlen, "%s (позиция %ld)", msg, (long)(ps->p - ps->start));
    return 0;
}

static void ws(P *ps) {
    while (*ps->p == ' ' || *ps->p == '\n' || *ps->p == '\r' || *ps->p == '\t') ps->p++;
}

static int hex4(const char *s, unsigned *out) {
    unsigned v = 0;
    for (int i = 0; i < 4; i++) {
        char c = s[i];
        v <<= 4;
        if (c >= '0' && c <= '9') v |= (unsigned)(c - '0');
        else if (c >= 'a' && c <= 'f') v |= (unsigned)(c - 'a' + 10);
        else if (c >= 'A' && c <= 'F') v |= (unsigned)(c - 'A' + 10);
        else return 0;
    }
    *out = v;
    return 1;
}

static size_t utf8_put(char *o, unsigned cp) {
    if (cp < 0x80) { o[0] = (char)cp; return 1; }
    if (cp < 0x800) { o[0] = (char)(0xC0 | (cp >> 6)); o[1] = (char)(0x80 | (cp & 0x3F)); return 2; }
    if (cp < 0x10000) {
        o[0] = (char)(0xE0 | (cp >> 12)); o[1] = (char)(0x80 | ((cp >> 6) & 0x3F)); o[2] = (char)(0x80 | (cp & 0x3F));
        return 3;
    }
    o[0] = (char)(0xF0 | (cp >> 18)); o[1] = (char)(0x80 | ((cp >> 12) & 0x3F));
    o[2] = (char)(0x80 | ((cp >> 6) & 0x3F)); o[3] = (char)(0x80 | (cp & 0x3F));
    return 4;
}

static int parse_string(P *ps, char **out) {
    ps->p++; /* открывающая кавычка */
    const char *s = ps->p;
    size_t cap = 0;
    while (s[cap] && s[cap] != '"') cap += (s[cap] == '\\' && s[cap + 1]) ? 2 : 1;
    char *o = xrealloc(NULL, cap + 1); /* экранирование только укорачивает строку */
    size_t n = 0;
    for (;;) {
        char c = *ps->p;
        if (c == '\0') { free(o); return fail(ps, "незакрытая строка"); }
        if (c == '"') { ps->p++; break; }
        if ((unsigned char)c < 0x20) { free(o); return fail(ps, "управляющий символ в строке"); }
        if (c != '\\') { o[n++] = c; ps->p++; continue; }
        ps->p++;
        c = *ps->p++;
        switch (c) {
        case '"': o[n++] = '"'; break;
        case '\\': o[n++] = '\\'; break;
        case '/': o[n++] = '/'; break;
        case 'b': o[n++] = '\b'; break;
        case 'f': o[n++] = '\f'; break;
        case 'n': o[n++] = '\n'; break;
        case 'r': o[n++] = '\r'; break;
        case 't': o[n++] = '\t'; break;
        case 'u': {
            unsigned cp;
            if (!hex4(ps->p, &cp)) { free(o); return fail(ps, "неверная \\u-последовательность"); }
            ps->p += 4;
            if (cp >= 0xD800 && cp <= 0xDBFF) {
                unsigned lo;
                if (ps->p[0] != '\\' || ps->p[1] != 'u' || !hex4(ps->p + 2, &lo) || lo < 0xDC00 || lo > 0xDFFF) {
                    free(o);
                    return fail(ps, "неполная суррогатная пара");
                }
                ps->p += 6;
                cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
            } else if (cp >= 0xDC00 && cp <= 0xDFFF) {
                free(o);
                return fail(ps, "одиночный суррогат");
            }
            if (cp == 0) cp = 0xFFFD; /* нулевой байт оборвал бы строку C */
            n += utf8_put(o + n, cp);
            break;
        }
        default: free(o); return fail(ps, "неизвестное экранирование");
        }
    }
    o[n] = '\0';
    *out = o;
    return 1;
}

static int parse_value(P *ps, JVal *v);

static int parse_array(P *ps, JVal *v) {
    v->type = J_ARR;
    ps->p++;
    ws(ps);
    if (*ps->p == ']') { ps->p++; return 1; }
    size_t cap = 0;
    for (;;) {
        if (v->len == cap) { cap = cap ? cap * 2 : 8; v->items = xrealloc(v->items, cap * sizeof *v->items); }
        memset(&v->items[v->len], 0, sizeof *v->items);
        if (!parse_value(ps, &v->items[v->len])) return 0;
        v->len++;
        ws(ps);
        if (*ps->p == ',') { ps->p++; continue; }
        if (*ps->p == ']') { ps->p++; return 1; }
        return fail(ps, "ожидалась , или ]");
    }
}

static int parse_object(P *ps, JVal *v) {
    v->type = J_OBJ;
    ps->p++;
    ws(ps);
    if (*ps->p == '}') { ps->p++; return 1; }
    size_t cap = 0;
    for (;;) {
        ws(ps);
        if (*ps->p != '"') return fail(ps, "ожидался ключ");
        if (v->len == cap) {
            cap = cap ? cap * 2 : 8;
            v->items = xrealloc(v->items, cap * sizeof *v->items);
            v->keys = xrealloc(v->keys, cap * sizeof *v->keys);
        }
        memset(&v->items[v->len], 0, sizeof *v->items);
        v->keys[v->len] = NULL;
        if (!parse_string(ps, &v->keys[v->len])) return 0;
        ws(ps);
        if (*ps->p != ':') { free(v->keys[v->len]); return fail(ps, "ожидалось :"); }
        ps->p++;
        if (!parse_value(ps, &v->items[v->len])) { free(v->keys[v->len]); return 0; }
        v->len++;
        ws(ps);
        if (*ps->p == ',') { ps->p++; continue; }
        if (*ps->p == '}') { ps->p++; return 1; }
        return fail(ps, "ожидалась , или }");
    }
}

static int parse_value(P *ps, JVal *v) {
    ws(ps);
    if (++ps->depth > 64) return fail(ps, "слишком глубокая вложенность");
    int ok;
    char c = *ps->p;
    if (c == '{') ok = parse_object(ps, v);
    else if (c == '[') ok = parse_array(ps, v);
    else if (c == '"') { v->type = J_STR; ok = parse_string(ps, &v->s); }
    else if (!strncmp(ps->p, "true", 4)) { v->type = J_BOOL; v->b = 1; ps->p += 4; ok = 1; }
    else if (!strncmp(ps->p, "false", 5)) { v->type = J_BOOL; ps->p += 5; ok = 1; }
    else if (!strncmp(ps->p, "null", 4)) { v->type = J_NULL; ps->p += 4; ok = 1; }
    else if (c == '-' || (c >= '0' && c <= '9')) {
        char *end;
        v->type = J_NUM;
        v->num = strtod(ps->p, &end);
        ok = end != ps->p;
        ps->p = end;
        if (!ok) fail(ps, "неверное число");
    } else ok = fail(ps, "неожиданный символ");
    ps->depth--;
    return ok;
}

JVal *json_parse(const char *text, char *err, size_t errlen) {
    P ps = {text, text, 0, err, errlen};
    JVal *v = calloc(1, sizeof *v);
    if (!v) return NULL;
    /* BOM, который любит добавлять Блокнот */
    if (!strncmp(ps.p, "\xEF\xBB\xBF", 3)) ps.p += 3;
    if (!parse_value(&ps, v)) return NULL; /* при ошибке память не освобождаем: процесс всё равно завершится */
    ws(&ps);
    if (*ps.p) { fail(&ps, "лишние данные после JSON"); return NULL; }
    return v;
}

const JVal *json_get(const JVal *obj, const char *key) {
    if (!obj || obj->type != J_OBJ) return NULL;
    for (size_t i = 0; i < obj->len; i++)
        if (!strcmp(obj->keys[i], key)) return &obj->items[i];
    return NULL;
}

const char *json_str(const JVal *obj, const char *key) {
    const JVal *v = json_get(obj, key);
    return v && v->type == J_STR ? v->s : NULL;
}
