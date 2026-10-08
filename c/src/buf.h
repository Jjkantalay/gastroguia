#ifndef BUF_H
#define BUF_H

#include <stddef.h>

/* Растущий буфер для сборки ответов и HTML */
typedef struct {
    char *p;
    size_t n, cap;
} Buf;

void buf_put(Buf *b, const char *s, size_t n);
void buf_puts(Buf *b, const char *s);
void buf_printf(Buf *b, const char *fmt, ...)
#if defined(__GNUC__)
    __attribute__((format(printf, 2, 3)))
#endif
    ;
/* Текст для HTML: экранирует & < > " ' */
void buf_html(Buf *b, const char *s);
/* Строка JSON в кавычках */
void buf_json(Buf *b, const char *s);
/* Значение для строки запроса (?q=...) */
void buf_urlenc(Buf *b, const char *s);
void buf_free(Buf *b);

#endif
