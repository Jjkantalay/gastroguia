#ifndef PAGES_H
#define PAGES_H

#include "buf.h"
#include "site.h"

/* Каждая функция пишет готовый документ (HTML или JSON) в out */
void page_home(Buf *out, const Site *site, Lang lang);
void page_catalog(Buf *out, const Site *site, Lang lang, const Filter *f);
int page_dish(Buf *out, const Site *site, Lang lang, const char *slug); /* 0 — блюда нет */
void page_not_found(Buf *out, Lang lang);

void api_dishes(Buf *out, const Site *site, Lang lang, const Filter *f);
int api_dish(Buf *out, const Site *site, const char *slug); /* 0 — блюда нет */

#endif
