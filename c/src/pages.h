#ifndef PAGES_H
#define PAGES_H

#include "buf.h"
#include "site.h"

/* Каждая функция пишет готовый документ (HTML или JSON) в out; lang — индекс в LANGS */
void page_home(Buf *out, const Site *site, int lang);
void page_catalog(Buf *out, const Site *site, int lang, const Filter *f);
int page_dish(Buf *out, const Site *site, int lang, const char *slug); /* 0 — блюда нет */
void page_photos(Buf *out, const Site *site, int lang);
void page_not_found(Buf *out, const Site *site, int lang);

void api_dishes(Buf *out, const Site *site, int lang, const Filter *f);
int api_dish(Buf *out, const Site *site, const char *slug); /* 0 — блюда нет */

#endif
