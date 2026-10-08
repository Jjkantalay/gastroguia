#include "pages.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "i18n.h"

/* Фирменная графика старого сайта, файлы скачивает npm run images:download */
#define U "/wp-content/uploads"
#define LOGO U "/2024/02/logo.svg"
#define QUOTE_ICON U "/2024/11/mask-group.svg"
#define FASIE U "/2025/02/fasie.svg"

#define COMPANY "ООО «ДЕМОНОВ»"
#define EMAIL "Jorjanoo@yandex.ru"
#define PHONE "+7 (938) 312-71-71"
#define PHONE_HREF "tel:+79383127171"
/* На старом сайте номер в ссылке WhatsApp отличается от телефона в контактах — уточнить */
#define WHATSAPP "https://wa.me/79383127271"

static const struct {
    const char *slug, *image;
} CUISINE_COVERS[] = {
    {"armyanskaya", U "/2025/04/frame-42-1.jpg"},
    {"gruzinskaya", U "/2025/04/frame-41.jpg"},
    {"chechenskaya", U "/2025/04/frame-40.jpg"},
};

typedef struct {
    Buf *b;
    const Site *site;
    Lang lang;
    const Labels *L;
} Ctx;

/* href с сохранением языка: /dishes/plov → /dishes/plov?lang=en */
static void href(Ctx *c, const char *path) {
    buf_html(c->b, path);
    if (c->lang != LANG_RU) buf_printf(c->b, "%clang=%s", strchr(path, '?') ? '&' : '?', c->L->code);
}

static void href_lang(Buf *b, const char *path, Lang lang) {
    buf_html(b, path);
    if (lang != LANG_RU) buf_printf(b, "%clang=%s", strchr(path, '?') ? '&' : '?', LABELS[lang].code);
}

static const char *cuisine_name(Ctx *c, const char *slug, char *tmp, size_t n) {
    const Cuisine *cu = site_cuisine(c->site, slug);
    return cu ? cuisine_title(cu->slug, cu->name, c->lang, tmp, n) : NULL;
}

/* --- каркас страницы --- */

static void page_begin(Ctx *c, const char *title, const char *description, const char *self, const char *image) {
    Buf *b = c->b;
    buf_printf(b, "<!doctype html>\n<html lang=\"%s\">\n<head>\n<meta charset=\"utf-8\">\n", c->L->html_lang);
    buf_puts(b, "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>");
    buf_html(b, title);
    buf_puts(b, "</title>\n<meta name=\"description\" content=\"");
    buf_html(b, description);
    buf_puts(b, "\">\n<meta property=\"og:title\" content=\"");
    buf_html(b, title);
    buf_puts(b, "\">\n");
    if (image) {
        buf_puts(b, "<meta property=\"og:image\" content=\"");
        buf_html(b, image);
        buf_puts(b, "\">\n");
    }
    /* Языковые версии одной страницы — для поисковиков */
    for (int l = 0; l < LANG_COUNT; l++) {
        buf_printf(b, "<link rel=\"alternate\" hreflang=\"%s\" href=\"", LABELS[l].code);
        href_lang(b, self, (Lang)l);
        buf_puts(b, "\">\n");
    }
    buf_puts(b,
             "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n"
             "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
             "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&amp;display=swap\">\n"
             "<link rel=\"stylesheet\" href=\"/static/style.css\">\n"
             "<script src=\"/static/site.js\" defer></script>\n"
             "</head>\n<body>\n");

    /* Шапка: бургер, языки, логотип по центру, ФСИ и поиск справа */
    buf_puts(b, "<header class=\"header\">\n<div class=\"header__bar\">\n<div class=\"header__left\">\n");
    buf_printf(b,
               "<button class=\"icon-btn\" type=\"button\" aria-label=\"%s\" aria-expanded=\"false\" aria-controls=\"nav\" data-menu>"
               "<svg width=\"28\" height=\"20\" viewBox=\"0 0 28 20\" aria-hidden=\"true\"><path d=\"M0 2h28M0 10h28M0 18h28\" stroke=\"currentColor\" stroke-width=\"3\"/></svg></button>\n",
               c->L->menu);
    buf_puts(b, "<nav class=\"langs\" aria-label=\"Язык\">");
    for (int l = 0; l < LANG_COUNT; l++) {
        buf_puts(b, "<a href=\"");
        href_lang(b, self, (Lang)l);
        buf_printf(b, "\" hreflang=\"%s\"%s>%c%c</a>", LABELS[l].code, l == (int)c->lang ? " aria-current=\"true\"" : "",
                   LABELS[l].code[0] - 32, LABELS[l].code[1] - 32);
    }
    buf_puts(b, "</nav>\n</div>\n<a class=\"header__logo\" href=\"");
    href(c, "/");
    buf_printf(b, "\"><img src=\"" LOGO "\" alt=\"%s\"></a>\n", c->lang == LANG_RU ? "Гастрогид" : "Gastroguia");
    buf_puts(b, "<div class=\"header__right\">\n<a class=\"header__fasie\" href=\"https://fasie.ru/\" target=\"_blank\" rel=\"noopener noreferrer\" title=\"Фонд содействия инновациям\"><img src=\"" FASIE "\" alt=\"Фонд содействия инновациям\"></a>\n");
    buf_printf(b, "<a class=\"icon-btn\" href=\"");
    href(c, "/dishes");
    buf_printf(b, "\" aria-label=\"%s\" title=\"%s\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\"><circle cx=\"10\" cy=\"10\" r=\"7\" stroke=\"currentColor\" stroke-width=\"2.5\"/><path d=\"M15.5 15.5 22 22\" stroke=\"currentColor\" stroke-width=\"2.5\"/></svg></a>\n",
               c->L->search_dishes, c->L->search_dishes);
    buf_puts(b, "</div>\n</div>\n<nav id=\"nav\" class=\"nav\" hidden>\n<ul>\n");
    const char *paths[] = {"/", "/dishes", "#contacts"};
    const char *labels[] = {c->L->home, c->L->dishes, c->L->contacts};
    for (int i = 0; i < 3; i++) {
        buf_puts(b, "<li><a href=\"");
        if (paths[i][0] == '#') buf_puts(b, paths[i]);
        else href(c, paths[i]);
        buf_puts(b, "\">");
        buf_html(b, labels[i]);
        buf_puts(b, "</a></li>\n");
    }
    buf_puts(b, "</ul>\n</nav>\n</header>\n<main class=\"main\">\n");
}

static void page_end(Ctx *c) {
    Buf *b = c->b;
    time_t now = time(NULL);
    struct tm *tm = gmtime(&now);
    int year = tm ? tm->tm_year + 1900 : 2026;
    buf_puts(b, "</main>\n<footer id=\"contacts\" class=\"footer\">\n<div class=\"footer__frame\">\n<div class=\"footer__cell\">\n");
    buf_printf(b, "<img class=\"footer__logo\" src=\"" LOGO "\" alt=\"%s\">\n", c->lang == LANG_RU ? "Гастрогид" : "Gastroguia");
    buf_printf(b, "<p class=\"serif-title\">%s</p>\n<p class=\"small\">%s<br>© %s, %d. %s</p>\n</div>\n", c->L->catalogue,
               c->L->tagline, c->lang == LANG_RU ? "ГАСТРОГИД" : "GASTROGUIA", year, c->L->rights);
    buf_printf(b, "<div class=\"footer__cell small\">\n<p class=\"serif-title\">%s</p>\n<p>" COMPANY "</p>\n"
                  "<a href=\"mailto:" EMAIL "\">" EMAIL "</a>\n<a href=\"" PHONE_HREF "\">" PHONE "</a>\n</div>\n",
               c->L->contacts);
    buf_puts(b, "<div class=\"footer__social\">\n"
                "<a class=\"social\" href=\"https://t.me/jorjanoo\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Telegram\"><img src=\"" U "/2025/03/vector-1.svg\" alt=\"\"></a>\n"
                "<a class=\"social\" href=\"https://vk.com/jorjanoo\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"ВКонтакте\"><img src=\"" U "/2025/03/vector.svg\" alt=\"\"></a>\n"
                "<a class=\"social\" href=\"" WHATSAPP "\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"WhatsApp\"><img src=\"" U "/2025/03/vector-2.svg\" alt=\"\"></a>\n"
                "</div>\n</div>\n</footer>\n</body>\n</html>\n");
}

/* --- части страниц --- */

static void section_heading(Ctx *c, const char *title, const char *hint, const char *id) {
    Buf *b = c->b;
    buf_puts(b, "<div class=\"section-heading\"");
    if (id) {
        buf_puts(b, " id=\"");
        buf_html(b, id);
        buf_puts(b, "\"");
    }
    buf_puts(b, "><h2 class=\"t-section\">");
    buf_html(b, title);
    buf_puts(b, "</h2>");
    if (hint) {
        buf_puts(b, "<p class=\"hint\">");
        buf_html(b, hint);
        buf_puts(b, "</p>");
    }
    buf_puts(b, "</div>\n");
}

/* Карточка как в листинге JetEngine: высокое фото, название поверх снизу */
static void dish_card(Ctx *c, const Dish *d) {
    Buf *b = c->b;
    const DishText *t = dish_text(d, c->lang);
    char path[256], tmp[128];
    snprintf(path, sizeof path, "/dishes/%s", d->slug);
    buf_puts(b, "<a class=\"card\" href=\"");
    href(c, path);
    buf_puts(b, "\">");
    if (d->image) {
        buf_puts(b, "<img src=\"");
        buf_html(b, d->image);
        buf_puts(b, "\" alt=\"\" loading=\"lazy\">");
    }
    buf_puts(b, "<span class=\"card__caption\"><span class=\"t-section\">");
    buf_html(b, t->name);
    buf_puts(b, "</span>");
    const char *cn = cuisine_name(c, d->cuisine, tmp, sizeof tmp);
    if (cn) {
        buf_puts(b, "<span class=\"card__sub\">");
        buf_html(b, cn);
        buf_puts(b, "</span>");
    }
    buf_puts(b, "</span></a>\n");
}

static void dish_row(Ctx *c, const Dish **list, size_t n) {
    buf_puts(c->b, "<div class=\"row\">\n");
    for (size_t i = 0; i < n; i++) dish_card(c, list[i]);
    buf_puts(c->b, "</div>\n");
}

/* --- главная --- */

void page_home(Buf *out, const Site *site, Lang lang) {
    Ctx c = {out, site, lang, &LABELS[lang]};
    page_begin(&c, c.L->site_title, c.L->site_description, "/", NULL);
    Buf *b = out;
    char tmp[128];

    buf_printf(b, "<h1 class=\"visually-hidden\">%s</h1>\n", c.L->site_title);

    /* Кухни с блюдами, по убыванию числа блюд */
    const Cuisine *order[64];
    size_t nc = 0;
    for (size_t i = 0; i < site->ncuisines && nc < 64; i++)
        if (site->cuisines[i].count > 0) order[nc++] = &site->cuisines[i];
    for (size_t i = 1; i < nc; i++)
        for (size_t j = i; j > 0 && order[j]->count > order[j - 1]->count; j--) {
            const Cuisine *t = order[j];
            order[j] = order[j - 1];
            order[j - 1] = t;
        }

    /* Бегущая лента кухонь: приглушённые фото, при наведении — цвет и подпись */
    if (nc) {
        buf_puts(b, "<div class=\"marquee\"><div class=\"marquee__track\">\n");
        for (int copy = 0; copy < 8; copy++) {
            for (size_t i = 0; i < nc; i++) {
                const char *image = NULL;
                for (size_t k = 0; k < sizeof CUISINE_COVERS / sizeof *CUISINE_COVERS; k++)
                    if (!strcmp(CUISINE_COVERS[k].slug, order[i]->slug)) image = CUISINE_COVERS[k].image;
                for (size_t k = 0; !image && k < site->ndishes; k++)
                    if (site->dishes[k].cuisine && !strcmp(site->dishes[k].cuisine, order[i]->slug)) image = site->dishes[k].image;
                /* Первая копия доступна с клавиатуры, остальные — только для бесшовной прокрутки */
                buf_printf(b, "<a class=\"slide\" href=\"#%s\"%s>", order[i]->slug, copy ? " tabindex=\"-1\" aria-hidden=\"true\"" : "");
                if (image) {
                    buf_puts(b, "<img src=\"");
                    buf_html(b, image);
                    buf_puts(b, "\" alt=\"\">");
                }
                buf_puts(b, "<span class=\"slide__info\"><span class=\"t-section\">");
                buf_html(b, cuisine_title(order[i]->slug, order[i]->name, lang, tmp, sizeof tmp));
                buf_printf(b, "</span><span class=\"slide__hint\">%s</span></span></a>\n", c.L->tap_cuisine);
            }
        }
        buf_puts(b, "</div></div>\n");
    }

    /* Поиск в рамке */
    buf_puts(b, "<form class=\"find frame\" action=\"/dishes\">\n<div class=\"find__text\">");
    buf_printf(b, "<p class=\"t-section\">%s</p><p class=\"hint\">%s</p>", c.L->find_title, c.L->find_hint);
    buf_printf(b, "<input name=\"q\" class=\"field\" placeholder=\"%s\" aria-label=\"%s\">", c.L->search_placeholder, c.L->find_title);
    if (lang != LANG_RU) buf_printf(b, "<input type=\"hidden\" name=\"lang\" value=\"%s\">", c.L->code);
    buf_printf(b, "</div>\n<button class=\"find__btn\">%s</button>\n</form>\n", c.L->find_btn);

    const Dish **list = malloc((site->ndishes ? site->ndishes : 1) * sizeof *list);
    for (size_t i = 0; i < nc; i++) {
        size_t n = 0;
        for (size_t k = 0; k < site->ndishes; k++)
            if (site->dishes[k].cuisine && !strcmp(site->dishes[k].cuisine, order[i]->slug)) list[n++] = &site->dishes[k];
        buf_puts(b, "<section class=\"section\">\n");
        section_heading(&c, cuisine_title(order[i]->slug, order[i]->name, lang, tmp, sizeof tmp), c.L->swipe, order[i]->slug);
        dish_row(&c, list, n);
        buf_puts(b, "</section>\n");
    }
    for (size_t k = 0; k < site->ndishes; k++) list[k] = &site->dishes[k];
    buf_puts(b, "<section class=\"section\">\n");
    section_heading(&c, c.L->all_dishes, c.L->swipe, NULL);
    dish_row(&c, list, site->ndishes);
    buf_puts(b, "<a class=\"btn-frame\" href=\"");
    href(&c, "/dishes");
    buf_printf(b, "\">%s →</a>\n</section>\n", c.L->search_dishes);
    free(list);
    page_end(&c);
}

/* --- каталог --- */

static void option(Buf *b, const char *value, const char *label, const char *selected) {
    buf_puts(b, "<option value=\"");
    buf_html(b, value);
    buf_puts(b, "\"");
    if (selected && !strcmp(selected, value)) buf_puts(b, " selected");
    buf_puts(b, ">");
    buf_html(b, label);
    buf_puts(b, "</option>");
}

static void checkbox(Buf *b, const char *name, const char *label, int checked) {
    buf_printf(b, "<label class=\"check\"><input type=\"checkbox\" name=\"%s\" value=\"1\"%s> ", name, checked ? " checked" : "");
    buf_html(b, label);
    buf_puts(b, "</label>");
}

static void catalog_self(Buf *b, const Filter *f) {
    buf_puts(b, "/dishes");
    char sep = '?';
    const char *keys[] = {"q", "cuisine", "course"};
    const char *vals[] = {f->q, f->cuisine, f->course};
    for (int i = 0; i < 3; i++) {
        if (!vals[i] || !*vals[i]) continue;
        buf_printf(b, "%c%s=", sep, keys[i]);
        buf_urlenc(b, vals[i]);
        sep = '&';
    }
    if (f->no_gluten) { buf_printf(b, "%cno_gluten=1", sep); sep = '&'; }
    if (f->no_lactose) { buf_printf(b, "%cno_lactose=1", sep); sep = '&'; }
    if (f->no_sugar) buf_printf(b, "%cno_sugar=1", sep);
}

void page_catalog(Buf *out, const Site *site, Lang lang, const Filter *f) {
    Ctx c = {out, site, lang, &LABELS[lang]};
    char title[256], tmp[128];
    snprintf(title, sizeof title, "%s — %s", c.L->all_dishes, lang == LANG_RU ? "Гастрогид" : "Gastroguia");
    Buf self = {0};
    catalog_self(&self, f);
    page_begin(&c, title, c.L->site_description, self.p, NULL);
    buf_free(&self);
    Buf *b = out;

    char *fq = f->q ? utf8_fold(f->q) : NULL;
    const Dish **list = malloc((site->ndishes ? site->ndishes : 1) * sizeof *list);
    size_t n = 0;
    for (size_t i = 0; i < site->ndishes; i++)
        if (dish_matches(&site->dishes[i], f, fq)) list[n++] = &site->dishes[i];
    free(fq);

    char found[64];
    snprintf(found, sizeof found, "%s: %lu", c.L->found, (unsigned long)n);
    buf_puts(b, "<h1 class=\"visually-hidden\">");
    buf_html(b, c.L->all_dishes);
    buf_puts(b, "</h1>\n");
    section_heading(&c, c.L->all_dishes, found, NULL);

    buf_puts(b, "<form class=\"filters frame\" action=\"/dishes\">\n<input name=\"q\" class=\"field filters__q\" value=\"");
    buf_html(b, f->q ? f->q : "");
    buf_printf(b, "\" placeholder=\"%s\" aria-label=\"%s\">\n", c.L->search_placeholder, c.L->find_title);
    buf_puts(b, "<select name=\"cuisine\" class=\"field\">");
    option(b, "", c.L->any_cuisine, f->cuisine);
    for (size_t i = 0; i < site->ncuisines; i++)
        if (site->cuisines[i].count > 0)
            option(b, site->cuisines[i].slug, cuisine_title(site->cuisines[i].slug, site->cuisines[i].name, lang, tmp, sizeof tmp), f->cuisine);
    buf_puts(b, "</select>\n<select name=\"course\" class=\"field\">");
    option(b, "", c.L->any_course, f->course);
    for (int i = 0; COURSE_VALUES[i]; i++) option(b, COURSE_VALUES[i], course_title(COURSE_VALUES[i], lang), f->course);
    buf_puts(b, "</select>\n<div class=\"filters__checks\">");
    checkbox(b, "no_gluten", c.L->no_gluten, f->no_gluten);
    checkbox(b, "no_lactose", c.L->no_lactose, f->no_lactose);
    checkbox(b, "no_sugar", c.L->no_sugar, f->no_sugar);
    buf_puts(b, "</div>\n");
    if (lang != LANG_RU) buf_printf(b, "<input type=\"hidden\" name=\"lang\" value=\"%s\">\n", c.L->code);
    buf_printf(b, "<button class=\"btn-dark\">%s</button>\n</form>\n", c.L->show);

    if (!n) buf_printf(b, "<p class=\"t-body\">%s</p>\n", c.L->nothing);
    else {
        buf_puts(b, "<div class=\"grid\">\n");
        for (size_t i = 0; i < n; i++) dish_card(&c, list[i]);
        buf_puts(b, "</div>\n");
    }
    free(list);
    page_end(&c);
}

/* --- страница блюда --- */

static void section_open(Buf *b, const char *title) {
    buf_puts(b, "<section class=\"dish-section\"><h2 class=\"t-label rule\">");
    buf_html(b, title);
    buf_puts(b, "</h2>\n");
}

/* Абзацы через пустую строку, переносы внутри абзаца сохраняются */
static void paragraphs(Buf *b, const char *text) {
    const char *p = text;
    while (*p) {
        const char *end = strstr(p, "\n\n");
        size_t len = end ? (size_t)(end - p) : strlen(p);
        char *chunk = malloc(len + 1);
        memcpy(chunk, p, len);
        chunk[len] = '\0';
        buf_puts(b, "<p>");
        buf_html(b, chunk);
        buf_puts(b, "</p>\n");
        free(chunk);
        if (!end) break;
        p = end;
        while (*p == '\n') p++;
    }
}

int page_dish(Buf *out, const Site *site, Lang lang, const char *slug) {
    const Dish *d = site_dish(site, slug);
    if (!d) return 0;
    Ctx c = {out, site, lang, &LABELS[lang]};
    const DishText *t = dish_text(d, lang);
    char title[512], tmp[128], self[256];
    const char *cn = cuisine_name(&c, d->cuisine, tmp, sizeof tmp);
    snprintf(title, sizeof title, "%s%s%s — %s", t->name, cn ? " — " : "", cn ? cn : "", lang == LANG_RU ? "Гастрогид" : "Gastroguia");
    snprintf(self, sizeof self, "/dishes/%s", d->slug);
    page_begin(&c, title, t->description ? t->description : "", self, d->image);
    Buf *b = out;

    /* Разметка для поисковиков */
    buf_puts(b, "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Article\",\"headline\":");
    buf_json(b, t->name);
    buf_puts(b, ",\"description\":");
    buf_json(b, t->description);
    if (d->image) {
        buf_puts(b, ",\"image\":");
        buf_json(b, d->image);
    }
    buf_printf(b, ",\"inLanguage\":\"%s\"}</script>\n", c.L->code);

    buf_puts(b, "<article class=\"dish\">\n<div class=\"dish__top\">\n<div class=\"dish__photo\">");
    if (d->image) {
        buf_puts(b, "<img src=\"");
        buf_html(b, d->image);
        buf_puts(b, "\" alt=\"");
        buf_html(b, t->name);
        buf_puts(b, "\">");
    }
    buf_puts(b, "</div>\n<div class=\"dish__info\">\n<p class=\"crumbs\"><a href=\"");
    href(&c, "/dishes");
    buf_printf(b, "\">// %s</a>", c.L->crumb_dishes);
    if (cn) {
        char anchor[160];
        snprintf(anchor, sizeof anchor, "/#%s", d->cuisine);
        buf_puts(b, " / <a href=\"");
        if (lang != LANG_RU) buf_printf(b, "/?lang=%s#%s", c.L->code, d->cuisine);
        else buf_html(b, anchor);
        buf_puts(b, "\">");
        char *lower = utf8_fold(cn);
        buf_html(b, lower);
        free(lower);
        buf_puts(b, "</a>");
    }
    buf_puts(b, "</p>\n<h1 class=\"t-title\">");
    buf_html(b, t->name);
    buf_puts(b, "</h1>\n");
    if (cn) {
        buf_puts(b, "<p class=\"t-label rule\">");
        buf_html(b, cn);
        buf_puts(b, "</p>\n");
    }
    if (t->description) {
        buf_puts(b, "<p class=\"t-body\">");
        buf_html(b, t->description);
        buf_puts(b, "</p>\n");
    }
    if (t->quote) {
        buf_puts(b, "<figure class=\"quote\"><img src=\"" QUOTE_ICON "\" alt=\"\"><blockquote>");
        buf_html(b, t->quote);
        buf_puts(b, "</blockquote></figure>\n");
    }
    buf_puts(b, "</div>\n</div>\n");

    section_open(b, c.L->ingredients);
    buf_puts(b, "<p class=\"t-body ingredients\">");
    buf_html(b, t->ingredients ? t->ingredients : c.L->not_specified);
    buf_puts(b, "</p>\n</section>\n");

    if (t->nallergens) {
        section_open(b, c.L->allergens);
        buf_puts(b, "<ul class=\"pills\">");
        for (int i = 0; i < t->nallergens; i++) {
            buf_puts(b, "<li>");
            buf_html(b, t->allergens[i]);
            buf_puts(b, "</li>");
        }
        buf_puts(b, "</ul>\n</section>\n");
    }

    if (t->history) {
        section_open(b, c.L->history);
        buf_puts(b, "<div class=\"t-body columns\">\n");
        paragraphs(b, t->history);
        buf_puts(b, "</div>\n</section>\n");
    }

    /* Сначала блюда той же кухни, затем остальные */
    const Dish *rel[3];
    size_t nr = 0;
    for (int pass = 0; pass < 2 && nr < 3; pass++)
        for (size_t i = 0; i < site->ndishes && nr < 3; i++) {
            const Dish *o = &site->dishes[i];
            int same = o->cuisine && d->cuisine && !strcmp(o->cuisine, d->cuisine);
            if (o == d || same != (pass == 0)) continue;
            rel[nr++] = o;
        }
    if (nr) {
        section_open(b, c.L->also);
        buf_puts(b, "<div class=\"grid grid--related\">\n");
        for (size_t i = 0; i < nr; i++) dish_card(&c, rel[i]);
        buf_puts(b, "</div>\n</section>\n");
    }
    buf_puts(b, "</article>\n");
    page_end(&c);
    return 1;
}

void page_not_found(Buf *out, Lang lang) {
    static const Site empty = {0};
    Ctx c = {out, &empty, lang, &LABELS[lang]};
    page_begin(&c, c.L->not_found, c.L->not_found, "/", NULL);
    buf_printf(out, "<div class=\"not-found frame\"><h1 class=\"t-section\">404 // %s</h1><p class=\"t-body\">%s</p><a class=\"btn-dark\" href=\"",
               c.L->not_found, c.L->not_found_hint);
    href(&c, "/dishes");
    buf_printf(out, "\">%s →</a></div>\n", c.L->all_dishes);
    page_end(&c);
}

/* --- JSON API --- */

static void json_text(Buf *b, const DishText *t) {
    buf_puts(b, "{\"name\":");
    buf_json(b, t->name);
    buf_puts(b, ",\"description\":");
    buf_json(b, t->description);
    buf_puts(b, ",\"quote\":");
    buf_json(b, t->quote);
    buf_puts(b, ",\"history\":");
    buf_json(b, t->history);
    buf_puts(b, ",\"ingredients\":");
    buf_json(b, t->ingredients);
    buf_puts(b, ",\"allergens\":[");
    for (int i = 0; i < t->nallergens; i++) {
        if (i) buf_puts(b, ",");
        buf_json(b, t->allergens[i]);
    }
    buf_puts(b, "]}");
}

void api_dishes(Buf *out, const Site *site, Lang lang, const Filter *f) {
    char *fq = f->q ? utf8_fold(f->q) : NULL;
    buf_puts(out, "{\"items\":[");
    int first = 1;
    for (size_t i = 0; i < site->ndishes; i++) {
        const Dish *d = &site->dishes[i];
        if (!dish_matches(d, f, fq)) continue;
        const DishText *t = dish_text(d, lang);
        buf_puts(out, first ? "\n" : ",\n");
        first = 0;
        buf_puts(out, "{\"slug\":");
        buf_json(out, d->slug);
        buf_puts(out, ",\"name\":");
        buf_json(out, t->name);
        buf_puts(out, ",\"cuisine\":");
        buf_json(out, d->cuisine);
        buf_puts(out, ",\"course\":");
        buf_json(out, d->course);
        buf_puts(out, ",\"description\":");
        buf_json(out, t->description);
        buf_puts(out, ",\"image\":");
        buf_json(out, d->image);
        buf_puts(out, "}");
    }
    buf_puts(out, "\n]}\n");
    free(fq);
}

int api_dish(Buf *out, const Site *site, const char *slug) {
    const Dish *d = site_dish(site, slug);
    if (!d) return 0;
    buf_puts(out, "{\"slug\":");
    buf_json(out, d->slug);
    buf_puts(out, ",\"cuisine\":");
    buf_json(out, d->cuisine);
    buf_puts(out, ",\"course\":");
    buf_json(out, d->course);
    buf_puts(out, ",\"image\":");
    buf_json(out, d->image);
    buf_puts(out, ",\"texts\":{");
    int first = 1;
    for (int l = 0; l < LANG_COUNT; l++) {
        if (!d->has[l]) continue;
        buf_printf(out, "%s\"%s\":", first ? "" : ",", LABELS[l].code);
        json_text(out, &d->text[l]);
        first = 0;
    }
    buf_puts(out, "}}\n");
    return 1;
}
