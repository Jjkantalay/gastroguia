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
    int lang;
} Ctx;

#define T(key) label(c->lang, key)

static void href_lang(Buf *b, const char *path, int lang) {
    buf_html(b, path);
    if (lang != LANG_RU) buf_printf(b, "%clang=%s", strchr(path, '?') ? '&' : '?', LANGS[lang].code);
}

/* href с сохранением языка: /dishes/plov → /dishes/plov?lang=en */
static void href(Ctx *c, const char *path) {
    href_lang(c->b, path, c->lang);
}

static const char *cuisine_name(Ctx *c, const char *slug) {
    const Cuisine *cu = site_cuisine(c->site, slug);
    return cu ? cuisine_label(c->lang, cu->slug, cu->name) : NULL;
}

/* Текст на языке страницы или запасной, с пометкой lang, если язык другой */
static void text_tag(Ctx *c, const char *tag, const char *cls, const Dish *d, Field field) {
    int from;
    const char *v = dish_get(d, c->lang, field, &from);
    if (!v) return;
    buf_printf(c->b, "<%s", tag);
    if (cls) buf_printf(c->b, " class=\"%s\"", cls);
    if (from != c->lang) buf_printf(c->b, " lang=\"%s\" dir=\"%s\"", LANGS[from].code, LANGS[from].rtl ? "rtl" : "ltr");
    buf_puts(c->b, ">");
    buf_html(c->b, v);
    buf_printf(c->b, "</%s>", tag);
}

/* Первая буква названия — для заглушки вместо фото */
static void initial(Buf *b, const char *s) {
    if (!s || !*s) return;
    const unsigned char *u = (const unsigned char *)s;
    size_t n = u[0] < 0x80 ? 1 : (u[0] & 0xE0) == 0xC0 ? 2 : (u[0] & 0xF0) == 0xE0 ? 3 : 4;
    for (size_t i = 1; i < n; i++)
        if (!u[i]) return;
    char tmp[5] = {0};
    memcpy(tmp, s, n);
    buf_html(b, tmp);
}

/* --- каркас страницы --- */

static void page_begin(Ctx *c, const char *title, const char *description, const char *self, const char *image) {
    Buf *b = c->b;
    const Language *L = &LANGS[c->lang];
    buf_printf(b, "<!doctype html>\n<html lang=\"%s\" dir=\"%s\">\n<head>\n<meta charset=\"utf-8\">\n", L->code, L->rtl ? "rtl" : "ltr");
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
    for (int l = 0; l < NLANGS; l++) {
        buf_printf(b, "<link rel=\"alternate\" hreflang=\"%s\" href=\"", LANGS[l].code);
        href_lang(b, self, l);
        buf_puts(b, "\">\n");
    }
    buf_puts(b,
             "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n"
             "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
             "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&amp;display=swap\">\n"
             "<link rel=\"stylesheet\" href=\"/static/style.css\">\n"
             "<script src=\"/static/site.js\" defer></script>\n"
             "</head>\n<body>\n");

    /* Шапка: бургер и языки слева, логотип по центру, ФСИ и поиск справа */
    buf_puts(b, "<header class=\"header\">\n<div class=\"header__bar\">\n<div class=\"header__left\">\n");
    buf_printf(b,
               "<button class=\"icon-btn\" type=\"button\" aria-label=\"%s\" aria-expanded=\"false\" aria-controls=\"nav\" data-menu>"
               "<svg width=\"28\" height=\"20\" viewBox=\"0 0 28 20\" aria-hidden=\"true\"><path d=\"M0 2h28M0 10h28M0 18h28\" stroke=\"currentColor\" stroke-width=\"3\"/></svg></button>\n",
               T(K_MENU));
    buf_printf(b, "<details class=\"langs\"><summary aria-label=\"%s\">%s</summary><ul>", T(K_LANGUAGE), L->code);
    for (int l = 0; l < NLANGS; l++) {
        buf_puts(b, "<li><a href=\"");
        href_lang(b, self, l);
        buf_printf(b, "\" hreflang=\"%s\" lang=\"%s\"%s>", LANGS[l].code, LANGS[l].code, l == c->lang ? " aria-current=\"true\"" : "");
        buf_html(b, LANGS[l].name);
        buf_puts(b, "</a></li>");
    }
    buf_puts(b, "</ul></details>\n</div>\n<a class=\"header__logo\" href=\"");
    href(c, "/");
    buf_puts(b, "\"><img src=\"" LOGO "\" alt=\"");
    buf_html(b, T(K_BRAND));
    buf_puts(b, "\"></a>\n<div class=\"header__right\">\n<a class=\"header__fasie\" href=\"https://fasie.ru/\" target=\"_blank\" rel=\"noopener noreferrer\" title=\"Фонд содействия инновациям\"><img src=\"" FASIE "\" alt=\"Фонд содействия инновациям\"></a>\n");
    buf_puts(b, "<a class=\"icon-btn\" href=\"");
    href(c, "/dishes");
    buf_printf(b, "\" aria-label=\"%s\" title=\"%s\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\"><circle cx=\"10\" cy=\"10\" r=\"7\" stroke=\"currentColor\" stroke-width=\"2.5\"/><path d=\"M15.5 15.5 22 22\" stroke=\"currentColor\" stroke-width=\"2.5\"/></svg></a>\n",
               T(K_SEARCH_DISHES), T(K_SEARCH_DISHES));
    buf_puts(b, "</div>\n</div>\n<nav id=\"nav\" class=\"nav\" hidden>\n<ul>\n");
    const char *paths[] = {"/", "/dishes", "#contacts"};
    LabelKey keys[] = {K_HOME, K_DISHES, K_CONTACTS};
    for (int i = 0; i < 3; i++) {
        buf_puts(b, "<li><a href=\"");
        if (paths[i][0] == '#') buf_puts(b, paths[i]);
        else href(c, paths[i]);
        buf_puts(b, "\">");
        buf_html(b, T(keys[i]));
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
    buf_puts(b, "<img class=\"footer__logo\" src=\"" LOGO "\" alt=\"");
    buf_html(b, T(K_BRAND));
    buf_puts(b, "\">\n<p class=\"serif-title\">");
    buf_html(b, T(K_CATALOGUE));
    buf_puts(b, "</p>\n<p class=\"small\">");
    buf_html(b, T(K_TAGLINE));
    buf_puts(b, "<br>© ");
    buf_html(b, T(K_BRAND));
    buf_printf(b, ", %d. ", year);
    buf_html(b, T(K_RIGHTS));
    buf_puts(b, "</p>\n</div>\n<div class=\"footer__cell small\">\n<p class=\"serif-title\">");
    buf_html(b, T(K_CONTACTS));
    buf_puts(b, "</p>\n<p>" COMPANY "</p>\n<a href=\"mailto:" EMAIL "\">" EMAIL "</a>\n<a href=\"" PHONE_HREF "\" dir=\"ltr\">" PHONE "</a>\n</div>\n");
    buf_puts(b, "<div class=\"footer__social\">\n"
                "<a class=\"social\" href=\"https://t.me/jorjanoo\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Telegram\"><img src=\"" U "/2025/03/vector-1.svg\" alt=\"\"></a>\n"
                "<a class=\"social\" href=\"https://vk.com/jorjanoo\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"VK\"><img src=\"" U "/2025/03/vector.svg\" alt=\"\"></a>\n"
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
    char path[256];
    snprintf(path, sizeof path, "/dishes/%s", d->slug);
    const char *name = dish_get(d, c->lang, F_NAME, NULL);
    buf_puts(b, "<a class=\"card");
    if (!d->image) buf_puts(b, " card--empty");
    buf_puts(b, "\" href=\"");
    href(c, path);
    buf_puts(b, "\">");
    if (d->image) {
        buf_puts(b, "<img src=\"");
        buf_html(b, d->image);
        buf_puts(b, "\" alt=\"\" loading=\"lazy\">");
    } else {
        buf_puts(b, "<span class=\"card__initial\" aria-hidden=\"true\">");
        initial(b, name);
        buf_puts(b, "</span>");
    }
    buf_puts(b, "<span class=\"card__caption\">");
    text_tag(c, "span", "t-section", d, F_NAME);
    const char *cn = cuisine_name(c, d->cuisine);
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

/* Кухни с блюдами, по убыванию числа блюд */
static size_t cuisines_by_count(const Site *site, const Cuisine **order, size_t max) {
    size_t nc = 0;
    for (size_t i = 0; i < site->ncuisines && nc < max; i++)
        if (site->cuisines[i].count > 0) order[nc++] = &site->cuisines[i];
    for (size_t i = 1; i < nc; i++)
        for (size_t j = i; j > 0 && order[j]->count > order[j - 1]->count; j--) {
            const Cuisine *t = order[j];
            order[j] = order[j - 1];
            order[j - 1] = t;
        }
    return nc;
}

/* --- главная --- */

void page_home(Buf *out, const Site *site, int lang) {
    Ctx ctx = {out, site, lang}, *c = &ctx;
    page_begin(c, T(K_SITE_TITLE), T(K_SITE_DESCRIPTION), "/", NULL);
    Buf *b = out;

    buf_puts(b, "<h1 class=\"visually-hidden\">");
    buf_html(b, T(K_SITE_TITLE));
    buf_puts(b, "</h1>\n");

    const Cuisine *order[64];
    size_t nc = cuisines_by_count(site, order, 64);

    /* Бегущая лента кухонь: приглушённые фото, при наведении — цвет и подпись */
    if (nc) {
        buf_puts(b, "<div class=\"marquee\" dir=\"ltr\"><div class=\"marquee__track\">\n");
        for (int copy = 0; copy < 4; copy++) {
            for (size_t i = 0; i < nc; i++) {
                const char *image = NULL;
                for (size_t k = 0; k < sizeof CUISINE_COVERS / sizeof *CUISINE_COVERS; k++)
                    if (!strcmp(CUISINE_COVERS[k].slug, order[i]->slug)) image = CUISINE_COVERS[k].image;
                for (size_t k = 0; !image && k < site->ndishes; k++)
                    if (site->dishes[k].cuisine && !strcmp(site->dishes[k].cuisine, order[i]->slug)) image = site->dishes[k].image;
                /* Первая копия доступна с клавиатуры, остальные — только для бесшовной прокрутки */
                buf_printf(b, "<a class=\"slide%s\" href=\"#%s\"%s>", image ? "" : " slide--empty", order[i]->slug,
                           copy ? " tabindex=\"-1\" aria-hidden=\"true\"" : "");
                const char *cname = cuisine_label(lang, order[i]->slug, order[i]->name);
                if (image) {
                    buf_puts(b, "<img src=\"");
                    buf_html(b, image);
                    buf_puts(b, "\" alt=\"\">");
                } else {
                    buf_puts(b, "<span class=\"card__initial\" aria-hidden=\"true\">");
                    initial(b, cname);
                    buf_puts(b, "</span>");
                }
                buf_printf(b, "<span class=\"slide__info\" dir=\"%s\"><span class=\"t-section\">", LANGS[lang].rtl ? "rtl" : "ltr");
                buf_html(b, cname);
                buf_puts(b, "</span><span class=\"slide__hint\">");
                buf_html(b, T(K_TAP_CUISINE));
                buf_puts(b, "</span></span></a>\n");
            }
        }
        buf_puts(b, "</div></div>\n");
    }

    /* Поиск в рамке */
    buf_puts(b, "<form class=\"find frame\" action=\"/dishes\">\n<div class=\"find__text\"><p class=\"t-section\">");
    buf_html(b, T(K_FIND_TITLE));
    buf_puts(b, "</p><p class=\"hint\">");
    buf_html(b, T(K_FIND_HINT));
    buf_puts(b, "</p><input name=\"q\" class=\"field\" placeholder=\"");
    buf_html(b, T(K_SEARCH_PLACEHOLDER));
    buf_puts(b, "\" aria-label=\"");
    buf_html(b, T(K_FIND_TITLE));
    buf_puts(b, "\">");
    if (lang != LANG_RU) buf_printf(b, "<input type=\"hidden\" name=\"lang\" value=\"%s\">", LANGS[lang].code);
    buf_puts(b, "</div>\n<button class=\"find__btn\">");
    buf_html(b, T(K_FIND_BTN));
    buf_puts(b, "</button>\n</form>\n");

    const Dish **list = malloc((site->ndishes ? site->ndishes : 1) * sizeof *list);
    for (size_t i = 0; i < nc; i++) {
        size_t n = 0;
        for (size_t k = 0; k < site->ndishes; k++)
            if (site->dishes[k].cuisine && !strcmp(site->dishes[k].cuisine, order[i]->slug)) list[n++] = &site->dishes[k];
        buf_puts(b, "<section class=\"section\">\n");
        section_heading(c, cuisine_label(lang, order[i]->slug, order[i]->name), T(K_SWIPE), order[i]->slug);
        dish_row(c, list, n);
        buf_puts(b, "</section>\n");
    }
    buf_puts(b, "<a class=\"btn-frame\" href=\"");
    href(c, "/dishes");
    buf_puts(b, "\">");
    buf_html(b, T(K_ALL_DISHES));
    buf_printf(b, " (%lu) →</a>\n", (unsigned long)site->ndishes);
    free(list);
    page_end(c);
}

/* --- каталог --- */

static void option(Buf *b, const char *value, const char *text, const char *selected) {
    buf_puts(b, "<option value=\"");
    buf_html(b, value);
    buf_puts(b, "\"");
    if (selected && !strcmp(selected, value)) buf_puts(b, " selected");
    buf_puts(b, ">");
    buf_html(b, text);
    buf_puts(b, "</option>");
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
    for (int a = 0; a < ALLERGEN_COUNT; a++)
        if (f->exclude & (1u << a)) {
            buf_printf(b, "%cx=%s", sep, ALLERGEN_CODES[a]);
            sep = '&';
        }
}

void page_catalog(Buf *out, const Site *site, int lang, const Filter *f) {
    Ctx ctx = {out, site, lang}, *c = &ctx;
    Buf title = {0}, self = {0};
    buf_printf(&title, "%s — %s", T(K_ALL_DISHES), T(K_BRAND));
    catalog_self(&self, f);
    page_begin(c, title.p, T(K_SITE_DESCRIPTION), self.p, NULL);
    buf_free(&title);
    buf_free(&self);
    Buf *b = out;

    char *fq = f->q ? utf8_fold(f->q) : NULL;
    const Dish **list = malloc((site->ndishes ? site->ndishes : 1) * sizeof *list);
    size_t n = 0;
    for (size_t i = 0; i < site->ndishes; i++)
        if (dish_matches(&site->dishes[i], f, fq)) list[n++] = &site->dishes[i];
    free(fq);

    Buf found = {0};
    buf_printf(&found, "%s: %lu", T(K_FOUND), (unsigned long)n);
    buf_puts(b, "<h1 class=\"visually-hidden\">");
    buf_html(b, T(K_ALL_DISHES));
    buf_puts(b, "</h1>\n");
    section_heading(c, T(K_ALL_DISHES), found.p, NULL);
    buf_free(&found);

    buf_puts(b, "<form class=\"filters frame\" action=\"/dishes\">\n<input name=\"q\" class=\"field filters__q\" value=\"");
    buf_html(b, f->q ? f->q : "");
    buf_puts(b, "\" placeholder=\"");
    buf_html(b, T(K_SEARCH_PLACEHOLDER));
    buf_puts(b, "\" aria-label=\"");
    buf_html(b, T(K_FIND_TITLE));
    buf_puts(b, "\">\n<select name=\"cuisine\" class=\"field\">");
    option(b, "", T(K_ANY_CUISINE), f->cuisine);
    const Cuisine *order[64];
    size_t nc = cuisines_by_count(site, order, 64);
    for (size_t i = 0; i < nc; i++) option(b, order[i]->slug, cuisine_label(lang, order[i]->slug, order[i]->name), f->cuisine);
    buf_puts(b, "</select>\n<select name=\"course\" class=\"field\">");
    option(b, "", T(K_ANY_COURSE), f->course);
    for (int i = 0; COURSE_VALUES[i]; i++) option(b, COURSE_VALUES[i], course_label(lang, COURSE_VALUES[i]), f->course);
    buf_puts(b, "</select>\n<fieldset class=\"filters__checks\"><legend>");
    buf_html(b, T(K_EXCLUDE));
    buf_puts(b, ":</legend>");
    for (int a = 0; a < ALLERGEN_COUNT; a++) {
        buf_printf(b, "<label class=\"check\"><input type=\"checkbox\" name=\"x\" value=\"%s\"%s> ", ALLERGEN_CODES[a],
                   f->exclude & (1u << a) ? " checked" : "");
        buf_html(b, allergen_label(lang, a));
        buf_puts(b, "</label>");
    }
    buf_puts(b, "</fieldset>\n");
    if (lang != LANG_RU) buf_printf(b, "<input type=\"hidden\" name=\"lang\" value=\"%s\">\n", LANGS[lang].code);
    buf_puts(b, "<button class=\"btn-dark\">");
    buf_html(b, T(K_SHOW));
    buf_puts(b, "</button>\n</form>\n");

    if (!n) {
        buf_puts(b, "<p class=\"t-body\">");
        buf_html(b, T(K_NOTHING));
        buf_puts(b, "</p>\n");
    } else {
        buf_puts(b, "<div class=\"grid\">\n");
        for (size_t i = 0; i < n; i++) dish_card(c, list[i]);
        buf_puts(b, "</div>\n");
    }
    free(list);
    page_end(c);
}

/* --- страница блюда --- */

static void section_open(Ctx *c, LabelKey title) {
    buf_puts(c->b, "<section class=\"dish-section\"><h2 class=\"t-label rule\">");
    buf_html(c->b, T(title));
    buf_puts(c->b, "</h2>\n");
}

/* Абзацы через пустую строку, переносы внутри абзаца сохраняются */
static void paragraphs(Buf *b, const char *text) {
    const char *p = text;
    while (*p) {
        const char *end = strstr(p, "\n\n");
        size_t len = end ? (size_t)(end - p) : strlen(p);
        Buf chunk = {0};
        buf_put(&chunk, p, len);
        buf_puts(b, "<p>");
        buf_html(b, chunk.p);
        buf_puts(b, "</p>\n");
        buf_free(&chunk);
        if (!end) break;
        p = end;
        while (*p == '\n') p++;
    }
}

int page_dish(Buf *out, const Site *site, int lang, const char *slug) {
    const Dish *d = site_dish(site, slug);
    if (!d) return 0;
    Ctx ctx = {out, site, lang}, *c = &ctx;
    const char *name = dish_get(d, lang, F_NAME, NULL);
    const char *cn = cuisine_name(c, d->cuisine);
    int desc_from;
    const char *desc = dish_get(d, lang, F_DESCRIPTION, &desc_from);
    Buf title = {0};
    buf_printf(&title, "%s%s%s — %s", name, cn ? " — " : "", cn ? cn : "", T(K_BRAND));
    char self[256];
    snprintf(self, sizeof self, "/dishes/%s", d->slug);
    page_begin(c, title.p, desc ? desc : "", self, d->image);
    buf_free(&title);
    Buf *b = out;

    /* Разметка для поисковиков */
    buf_puts(b, "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Article\",\"headline\":");
    buf_json(b, name);
    buf_puts(b, ",\"description\":");
    buf_json(b, desc);
    if (d->image) {
        buf_puts(b, ",\"image\":");
        buf_json(b, d->image);
    }
    buf_printf(b, ",\"inLanguage\":\"%s\"}</script>\n", LANGS[desc_from].code);

    buf_puts(b, "<article class=\"dish\">\n<div class=\"dish__top\">\n<div class=\"dish__photo");
    if (!d->image) buf_puts(b, " dish__photo--empty");
    buf_puts(b, "\">");
    if (d->image) {
        buf_puts(b, "<img src=\"");
        buf_html(b, d->image);
        buf_puts(b, "\" alt=\"");
        buf_html(b, name);
        buf_puts(b, "\">");
    } else {
        buf_puts(b, "<span class=\"card__initial\" aria-hidden=\"true\">");
        initial(b, name);
        buf_puts(b, "</span>");
    }
    buf_puts(b, "</div>\n<div class=\"dish__info\">\n<p class=\"crumbs\"><a href=\"");
    href(c, "/dishes");
    buf_puts(b, "\">// ");
    buf_html(b, T(K_CRUMB_DISHES));
    buf_puts(b, "</a>");
    if (cn) {
        buf_puts(b, " / <a href=\"/");
        if (lang != LANG_RU) buf_printf(b, "?lang=%s", LANGS[lang].code);
        buf_puts(b, "#");
        buf_html(b, d->cuisine);
        buf_puts(b, "\">");
        buf_html(b, cn);
        buf_puts(b, "</a>");
    }
    buf_puts(b, "</p>\n");
    text_tag(c, "h1", "t-title", d, F_NAME);
    if (cn) {
        buf_puts(b, "<p class=\"t-label rule\">");
        buf_html(b, cn);
        const char *course = course_label(lang, d->course);
        if (course) {
            buf_puts(b, " · ");
            buf_html(b, course);
        }
        buf_puts(b, "</p>\n");
    }
    /* Если описания на языке страницы нет — честно говорим, что текст на английском */
    if (desc && desc_from != lang && lang != LANG_RU) {
        buf_puts(b, "<p class=\"note\">");
        buf_html(b, T(K_IN_ENGLISH));
        buf_puts(b, "</p>\n");
    }
    text_tag(c, "p", "t-body", d, F_DESCRIPTION);
    if (dish_get(d, lang, F_QUOTE, NULL)) {
        buf_puts(b, "<figure class=\"quote\"><img src=\"" QUOTE_ICON "\" alt=\"\">");
        text_tag(c, "blockquote", NULL, d, F_QUOTE);
        buf_puts(b, "</figure>\n");
    }
    buf_puts(b, "</div>\n</div>\n");

    section_open(c, K_INGREDIENTS);
    if (dish_get(d, lang, F_INGREDIENTS, NULL)) text_tag(c, "p", "t-body ingredients", d, F_INGREDIENTS);
    else {
        buf_puts(b, "<p class=\"t-body\">");
        buf_html(b, T(K_NOT_SPECIFIED));
        buf_puts(b, "</p>");
    }
    buf_puts(b, "\n</section>\n");

    if (d->allergens) {
        section_open(c, K_ALLERGENS);
        buf_puts(b, "<ul class=\"pills\">");
        for (int a = 0; a < ALLERGEN_COUNT; a++)
            if (d->allergens & (1u << a)) {
                buf_puts(b, "<li>");
                buf_html(b, allergen_label(lang, a));
                buf_puts(b, "</li>");
            }
        buf_puts(b, "</ul>\n</section>\n");
    }

    int hist_from;
    const char *history = dish_get(d, lang, F_HISTORY, &hist_from);
    if (history) {
        section_open(c, K_HISTORY);
        buf_puts(b, "<div class=\"t-body columns\"");
        if (hist_from != lang) buf_printf(b, " lang=\"%s\" dir=\"%s\"", LANGS[hist_from].code, LANGS[hist_from].rtl ? "rtl" : "ltr");
        buf_puts(b, ">\n");
        paragraphs(b, history);
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
        section_open(c, K_ALSO);
        buf_puts(b, "<div class=\"grid grid--related\">\n");
        for (size_t i = 0; i < nr; i++) dish_card(c, rel[i]);
        buf_puts(b, "</div>\n</section>\n");
    }
    buf_puts(b, "</article>\n");
    page_end(c);
    return 1;
}

void page_not_found(Buf *out, const Site *site, int lang) {
    Ctx ctx = {out, site, lang}, *c = &ctx;
    page_begin(c, T(K_NOT_FOUND), T(K_NOT_FOUND), "/", NULL);
    buf_puts(out, "<div class=\"not-found frame\"><h1 class=\"t-section\">404 // ");
    buf_html(out, T(K_NOT_FOUND));
    buf_puts(out, "</h1><p class=\"t-body\">");
    buf_html(out, T(K_NOT_FOUND_HINT));
    buf_puts(out, "</p><a class=\"btn-dark\" href=\"");
    href(c, "/dishes");
    buf_puts(out, "\">");
    buf_html(out, T(K_ALL_DISHES));
    buf_puts(out, " →</a></div>\n");
    page_end(c);
}

/* --- JSON API --- */

void api_dishes(Buf *out, const Site *site, int lang, const Filter *f) {
    char *fq = f->q ? utf8_fold(f->q) : NULL;
    buf_puts(out, "{\"items\":[");
    int first = 1;
    for (size_t i = 0; i < site->ndishes; i++) {
        const Dish *d = &site->dishes[i];
        if (!dish_matches(d, f, fq)) continue;
        buf_puts(out, first ? "\n" : ",\n");
        first = 0;
        buf_puts(out, "{\"slug\":");
        buf_json(out, d->slug);
        buf_puts(out, ",\"name\":");
        buf_json(out, dish_get(d, lang, F_NAME, NULL));
        buf_puts(out, ",\"cuisine\":");
        buf_json(out, d->cuisine);
        buf_puts(out, ",\"course\":");
        buf_json(out, d->course);
        buf_puts(out, ",\"description\":");
        buf_json(out, dish_get(d, lang, F_DESCRIPTION, NULL));
        buf_puts(out, ",\"image\":");
        buf_json(out, d->image);
        buf_puts(out, "}");
    }
    buf_puts(out, "\n]}\n");
    free(fq);
}

int api_dish(Buf *out, const Site *site, const char *slug) {
    static const char *const KEYS[F_COUNT] = {"name", "description", "quote", "history", "ingredients"};
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
    buf_puts(out, ",\"allergens\":[");
    int first = 1;
    for (int a = 0; a < ALLERGEN_COUNT; a++)
        if (d->allergens & (1u << a)) {
            buf_printf(out, "%s\"%s\"", first ? "" : ",", ALLERGEN_CODES[a]);
            first = 0;
        }
    buf_puts(out, "],\"texts\":{");
    first = 1;
    for (int l = 0; l < NLANGS; l++) {
        int any = 0;
        for (int f = 0; f < F_COUNT; f++) any |= d->text[l][f] != NULL;
        if (!any) continue;
        buf_printf(out, "%s\"%s\":{", first ? "" : ",", LANGS[l].code);
        first = 0;
        int fi = 1;
        for (int f = 0; f < F_COUNT; f++)
            if (d->text[l][f]) {
                buf_printf(out, "%s\"%s\":", fi ? "" : ",", KEYS[f]);
                buf_json(out, d->text[l][f]);
                fi = 0;
            }
        buf_puts(out, "}");
    }
    buf_puts(out, "}}\n");
    return 1;
}
