#include "site.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "json.h"

static char *read_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    Buf b = {0};
    char chunk[65536];
    size_t n;
    while ((n = fread(chunk, 1, sizeof chunk, f)) > 0) buf_put(&b, chunk, n);
    fclose(f);
    if (!b.p) buf_puts(&b, "");
    return b.p;
}

static void load_text(DishText *t, const JVal *o) {
    t->name = json_str(o, "name");
    t->description = json_str(o, "description");
    t->quote = json_str(o, "quote");
    t->history = json_str(o, "history");
    t->ingredients = json_str(o, "ingredientsText");
    const JVal *a = json_get(o, "allergens");
    if (a && a->type == J_ARR)
        for (size_t i = 0; i < a->len && t->nallergens < MAX_ALLERGENS; i++)
            if (a->items[i].type == J_STR) t->allergens[t->nallergens++] = a->items[i].s;
}

static const char *LANG_KEYS[LANG_COUNT] = {"ru", "en", "es"};

static void append_folded(Buf *b, const char *s) {
    if (!s) return;
    char *f = utf8_fold(s);
    buf_puts(b, f);
    buf_puts(b, "\n");
    free(f);
}

int site_load(Site *site, const char *path) {
    char *text = read_file(path);
    if (!text) {
        fprintf(stderr, "Не удалось открыть %s\n", path);
        return 0;
    }
    char err[200];
    JVal *root = json_parse(text, err, sizeof err);
    free(text);
    if (!root) {
        fprintf(stderr, "Ошибка в %s: %s\n", path, err);
        return 0;
    }

    const JVal *cs = json_get(root, "cuisines");
    if (cs && cs->type == J_ARR) {
        site->cuisines = calloc(cs->len ? cs->len : 1, sizeof *site->cuisines);
        for (size_t i = 0; i < cs->len; i++) {
            const char *slug = json_str(&cs->items[i], "slug"), *name = json_str(&cs->items[i], "name");
            if (slug && name) site->cuisines[site->ncuisines++] = (Cuisine){slug, name, 0};
        }
    }

    const JVal *ds = json_get(root, "dishes");
    if (!ds || ds->type != J_ARR) {
        fprintf(stderr, "В %s нет списка dishes\n", path);
        return 0;
    }
    site->dishes = calloc(ds->len ? ds->len : 1, sizeof *site->dishes);
    for (size_t i = 0; i < ds->len; i++) {
        const JVal *o = &ds->items[i];
        Dish *d = &site->dishes[site->ndishes];
        d->slug = json_str(o, "slug");
        if (!d->slug || !json_str(o, "name")) continue;
        d->cuisine = json_str(o, "cuisine");
        d->course = json_str(o, "course");
        d->image = json_str(o, "image");
        load_text(&d->text[LANG_RU], o);
        d->has[LANG_RU] = 1;
        const JVal *tr = json_get(o, "translations");
        for (int l = 1; l < LANG_COUNT; l++) {
            const JVal *t = json_get(tr, LANG_KEYS[l]);
            if (t && t->type == J_OBJ && json_str(t, "name")) {
                load_text(&d->text[l], t);
                d->has[l] = 1;
            }
        }
        Buf h = {0};
        for (int l = 0; l < LANG_COUNT; l++) {
            if (!d->has[l]) continue;
            append_folded(&h, d->text[l].name);
            append_folded(&h, d->text[l].description);
            append_folded(&h, d->text[l].ingredients);
        }
        const Cuisine *c = site_cuisine(site, d->cuisine);
        if (c) append_folded(&h, c->name);
        d->haystack = h.p ? h.p : calloc(1, 1);
        if (c) ((Cuisine *)c)->count++;
        site->ndishes++;
    }

    const JVal *rs = json_get(root, "redirects");
    if (rs && rs->type == J_ARR) {
        site->redirects = calloc(rs->len ? rs->len : 1, sizeof *site->redirects);
        for (size_t i = 0; i < rs->len; i++) {
            const char *src = json_str(&rs->items[i], "source"), *dst = json_str(&rs->items[i], "destination");
            if (src && dst) site->redirects[site->nredirects++] = (Redirect){src, dst};
        }
    }
    /* Дерево JSON живёт до конца работы: строки блюд указывают прямо в него */
    return 1;
}

const Dish *site_dish(const Site *site, const char *slug) {
    for (size_t i = 0; i < site->ndishes; i++)
        if (!strcmp(site->dishes[i].slug, slug)) return &site->dishes[i];
    return NULL;
}

const Cuisine *site_cuisine(const Site *site, const char *slug) {
    if (!slug) return NULL;
    for (size_t i = 0; i < site->ncuisines; i++)
        if (!strcmp(site->cuisines[i].slug, slug)) return &site->cuisines[i];
    return NULL;
}

const DishText *dish_text(const Dish *d, Lang lang) {
    return d->has[lang] ? &d->text[lang] : &d->text[LANG_RU];
}

/* --- UTF-8 --- */

static unsigned decode(const unsigned char **p) {
    const unsigned char *s = *p;
    unsigned cp;
    int extra;
    if (s[0] < 0x80) { cp = s[0]; extra = 0; }
    else if ((s[0] & 0xE0) == 0xC0) { cp = s[0] & 0x1F; extra = 1; }
    else if ((s[0] & 0xF0) == 0xE0) { cp = s[0] & 0x0F; extra = 2; }
    else if ((s[0] & 0xF8) == 0xF0) { cp = s[0] & 0x07; extra = 3; }
    else { *p = s + 1; return 0xFFFD; }
    for (int i = 1; i <= extra; i++) {
        if ((s[i] & 0xC0) != 0x80) { *p = s + 1; return 0xFFFD; }
        cp = (cp << 6) | (s[i] & 0x3F);
    }
    *p = s + 1 + extra;
    return cp;
}

static void encode(Buf *b, unsigned cp) {
    char o[4];
    size_t n;
    if (cp < 0x80) { o[0] = (char)cp; n = 1; }
    else if (cp < 0x800) { o[0] = (char)(0xC0 | (cp >> 6)); o[1] = (char)(0x80 | (cp & 0x3F)); n = 2; }
    else if (cp < 0x10000) {
        o[0] = (char)(0xE0 | (cp >> 12)); o[1] = (char)(0x80 | ((cp >> 6) & 0x3F)); o[2] = (char)(0x80 | (cp & 0x3F));
        n = 3;
    } else {
        o[0] = (char)(0xF0 | (cp >> 18)); o[1] = (char)(0x80 | ((cp >> 12) & 0x3F));
        o[2] = (char)(0x80 | ((cp >> 6) & 0x3F)); o[3] = (char)(0x80 | (cp & 0x3F)); n = 4;
    }
    buf_put(b, o, n);
}

char *utf8_fold(const char *s) {
    Buf b = {0};
    const unsigned char *p = (const unsigned char *)s;
    while (*p) {
        unsigned cp = decode(&p);
        if (cp >= 'A' && cp <= 'Z') cp += 32;
        else if (cp >= 0x410 && cp <= 0x42F) cp += 0x20;              /* А–Я */
        else if (cp >= 0x400 && cp <= 0x40F) cp += 0x50;              /* Ѐ–Џ */
        else if (cp >= 0xC0 && cp <= 0xDE && cp != 0xD7) cp += 0x20; /* À–Þ */
        if (cp == 0x451) cp = 0x435;                                  /* ё → е */
        encode(&b, cp);
    }
    if (!b.p) buf_puts(&b, "");
    return b.p;
}

static int has_allergen(const Dish *d, const char *needle) {
    for (int i = 0; i < d->text[LANG_RU].nallergens; i++) {
        char *f = utf8_fold(d->text[LANG_RU].allergens[i]);
        int hit = strstr(f, needle) != NULL;
        free(f);
        if (hit) return 1;
    }
    return 0;
}

/* Грубое отсечение окончания: «тыква» → «тыкв», «супы» → «суп», чтобы находить и «тыквой» */
static size_t stem_len(const char *w, size_t len) {
    static const char *const ENDINGS[] = {"а", "я", "о", "е", "ы", "и", "у", "ю", "й", "ь", "s", NULL};
    for (int round = 0; round < 2; round++) {
        int cut = 0;
        for (int i = 0; ENDINGS[i]; i++) {
            size_t el = strlen(ENDINGS[i]);
            /* Корень оставляем не короче трёх букв (кириллица — по 2 байта) */
            if (len >= el + 6 && !memcmp(w + len - el, ENDINGS[i], el)) {
                len -= el;
                cut = 1;
                break;
            }
        }
        if (!cut) break;
    }
    return len;
}

/* Каждое слово запроса должно встретиться в текстах блюда */
static int matches_query(const char *haystack, const char *q) {
    const char *p = q;
    while (*p) {
        while (*p == ' ' || *p == ',' || *p == '\t') p++;
        const char *end = p;
        while (*end && *end != ' ' && *end != ',' && *end != '\t') end++;
        size_t len = (size_t)(end - p);
        if (len) {
            len = stem_len(p, len);
            char word[256];
            if (len >= sizeof word) len = sizeof word - 1;
            memcpy(word, p, len);
            word[len] = '\0';
            if (!strstr(haystack, word)) return 0;
        }
        p = end;
    }
    return 1;
}

int dish_matches(const Dish *d, const Filter *f, const char *folded_q) {
    if (f->cuisine && *f->cuisine && (!d->cuisine || strcmp(d->cuisine, f->cuisine))) return 0;
    if (f->course && *f->course && (!d->course || strcmp(d->course, f->course))) return 0;
    if (folded_q && *folded_q && !matches_query(d->haystack, folded_q)) return 0;
    /* «Без …» — только если аллергены у блюда указаны и нужного среди них нет */
    int known = d->text[LANG_RU].nallergens > 0;
    if (f->no_gluten && (!known || has_allergen(d, "глютен"))) return 0;
    if (f->no_lactose && (!known || has_allergen(d, "лактоз"))) return 0;
    if (f->no_sugar && (!known || has_allergen(d, "сахар"))) return 0;
    return 1;
}
