#include "buf.h"

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void grow(Buf *b, size_t extra) {
    if (b->n + extra + 1 <= b->cap) return;
    size_t cap = b->cap ? b->cap : 1024;
    while (cap < b->n + extra + 1) cap *= 2;
    char *p = realloc(b->p, cap);
    if (!p) {
        fputs("Не хватает памяти\n", stderr);
        exit(1);
    }
    b->p = p;
    b->cap = cap;
}

void buf_put(Buf *b, const char *s, size_t n) {
    grow(b, n);
    memcpy(b->p + b->n, s, n);
    b->n += n;
    b->p[b->n] = '\0';
}

void buf_puts(Buf *b, const char *s) {
    if (s) buf_put(b, s, strlen(s));
}

void buf_printf(Buf *b, const char *fmt, ...) {
    char small[512];
    va_list ap;
    va_start(ap, fmt);
    va_list ap2;
    va_copy(ap2, ap);
    int len = vsnprintf(small, sizeof small, fmt, ap);
    va_end(ap);
    if (len > 0 && (size_t)len < sizeof small) buf_put(b, small, (size_t)len);
    else if (len > 0) {
        grow(b, (size_t)len);
        vsnprintf(b->p + b->n, (size_t)len + 1, fmt, ap2);
        b->n += (size_t)len;
    }
    va_end(ap2);
}

void buf_html(Buf *b, const char *s) {
    if (!s) return;
    for (; *s; s++) {
        switch (*s) {
        case '&': buf_puts(b, "&amp;"); break;
        case '<': buf_puts(b, "&lt;"); break;
        case '>': buf_puts(b, "&gt;"); break;
        case '"': buf_puts(b, "&quot;"); break;
        case '\'': buf_puts(b, "&#39;"); break;
        default: buf_put(b, s, 1);
        }
    }
}

void buf_json(Buf *b, const char *s) {
    if (!s) {
        buf_puts(b, "null");
        return;
    }
    buf_put(b, "\"", 1);
    for (const unsigned char *u = (const unsigned char *)s; *u; u++) {
        switch (*u) {
        case '"': buf_puts(b, "\\\""); break;
        case '\\': buf_puts(b, "\\\\"); break;
        case '\n': buf_puts(b, "\\n"); break;
        case '\r': buf_puts(b, "\\r"); break;
        case '\t': buf_puts(b, "\\t"); break;
        /* </script> внутри JSON-LD не должен закрывать тег */
        case '<': buf_puts(b, "\\u003c"); break;
        default:
            if (*u < 0x20) buf_printf(b, "\\u%04x", *u);
            else buf_put(b, (const char *)u, 1);
        }
    }
    buf_put(b, "\"", 1);
}

void buf_urlenc(Buf *b, const char *s) {
    static const char hex[] = "0123456789ABCDEF";
    for (const unsigned char *u = (const unsigned char *)s; *u; u++) {
        if ((*u >= 'a' && *u <= 'z') || (*u >= 'A' && *u <= 'Z') || (*u >= '0' && *u <= '9') || *u == '-' ||
            *u == '_' || *u == '.' || *u == '~') {
            buf_put(b, (const char *)u, 1);
        } else {
            char e[3] = {'%', hex[*u >> 4], hex[*u & 15]};
            buf_put(b, e, 3);
        }
    }
}

void buf_free(Buf *b) {
    free(b->p);
    b->p = NULL;
    b->n = b->cap = 0;
}
