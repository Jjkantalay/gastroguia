#include "site.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "buf.h"
#include "json.h"

static const char *const FIELD_KEYS[F_COUNT] = {"name", "description", "quote", "history", "ingredientsText"};

static JVal *load_json(const char *path, int required) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        if (required) fprintf(stderr, "Не удалось открыть %s\n", path);
        return NULL;
    }
    Buf b = {0};
    char chunk[65536];
    size_t n;
    while ((n = fread(chunk, 1, sizeof chunk, f)) > 0) buf_put(&b, chunk, n);
    fclose(f);
    char err[200];
    JVal *root = json_parse(b.p ? b.p : "", err, sizeof err);
    buf_free(&b);
    if (!root) fprintf(stderr, "Ошибка в %s: %s\n", path, err);
    return root;
}

static void set_texts(Dish *d, int lang, const JVal *o) {
    for (int f = 0; f < F_COUNT; f++) {
        const char *v = json_str(o, FIELD_KEYS[f]);
        if (v && *v) d->text[lang][f] = v;
    }
}

/* Старые блюда хранят аллергены словами по-русски — переводим в коды */
static unsigned allergens_from_words(const JVal *arr) {
    static const char *const STEMS[ALLERGEN_COUNT] = {"глютен", "лактоз", "яйц", "орех", "сахар", "кунжут", "рыб"};
    unsigned bits = 0;
    if (!arr || arr->type != J_ARR) return 0;
    for (size_t i = 0; i < arr->len; i++) {
        if (arr->items[i].type != J_STR) continue;
        char *f = utf8_fold(arr->items[i].s);
        for (int a = 0; a < ALLERGEN_COUNT; a++)
            if (strstr(f, STEMS[a])) bits |= 1u << a;
        free(f);
    }
    return bits;
}

static unsigned allergens_from_codes(const JVal *arr) {
    unsigned bits = 0;
    if (!arr || arr->type != J_ARR) return 0;
    for (size_t i = 0; i < arr->len; i++)
        for (int a = 0; a < ALLERGEN_COUNT; a++)
            if (arr->items[i].type == J_STR && !strcmp(arr->items[i].s, ALLERGEN_CODES[a])) bits |= 1u << a;
    return bits;
}

static void add_dishes(Site *site, const JVal *list) {
    if (!list || list->type != J_ARR) return;
    for (size_t i = 0; i < list->len; i++) {
        const JVal *o = &list->items[i];
        const char *slug = json_str(o, "slug");
        if (!slug || !json_str(o, "name") || site_dish(site, slug)) continue;
        if (site->ndishes == site->cap) {
            site->cap = site->cap ? site->cap * 2 : 64;
            site->dishes = realloc(site->dishes, site->cap * sizeof *site->dishes);
            if (!site->dishes) { fputs("Не хватает памяти\n", stderr); exit(1); }
        }
        Dish *d = &site->dishes[site->ndishes++];
        memset(d, 0, sizeof *d);
        d->slug = slug;
        d->cuisine = json_str(o, "cuisine");
        d->course = json_str(o, "course");
        d->image = json_str(o, "image");
        const JVal *codes = json_get(o, "allergenCodes");
        d->allergens = codes ? allergens_from_codes(codes) : allergens_from_words(json_get(o, "allergens"));
        set_texts(d, LANG_RU, o);
        const JVal *tr = json_get(o, "translations");
        if (tr && tr->type == J_OBJ)
            for (size_t k = 0; k < tr->len; k++) {
                int lang = lang_find(tr->keys[k]);
                if (lang != LANG_RU || !strcmp(tr->keys[k], "ru")) set_texts(d, lang, &tr->items[k]);
            }
    }
}

/* Названия блюд на языках, для которых нет полных текстов */
static void add_names(Site *site, const JVal *names) {
    if (!names || names->type != J_OBJ) return;
    for (size_t i = 0; i < names->len; i++) {
        Dish *d = (Dish *)site_dish(site, names->keys[i]);
        const JVal *m = &names->items[i];
        if (!d || m->type != J_OBJ) continue;
        for (size_t k = 0; k < m->len; k++) {
            int lang = lang_find(m->keys[k]);
            if (lang == LANG_RU && strcmp(m->keys[k], "ru")) continue;
            if (m->items[k].type == J_STR && *m->items[k].s && !d->text[lang][F_NAME]) d->text[lang][F_NAME] = m->items[k].s;
        }
    }
}

/* Полные переводы: content/translations/<код>.json, {"слаг": {"name": …, "description": …}} */
static void add_translations(Site *site, const char *dir) {
    for (int l = 0; l < NLANGS; l++) {
        char path[1024];
        snprintf(path, sizeof path, "%s/translations/%s.json", dir, LANGS[l].code);
        JVal *t = load_json(path, 0);
        if (!t || t->type != J_OBJ) continue;
        for (size_t i = 0; i < t->len; i++) {
            Dish *d = (Dish *)site_dish(site, t->keys[i]);
            if (!d || t->items[i].type != J_OBJ) continue;
            for (int f = 0; f < F_COUNT; f++) {
                const char *v = json_str(&t->items[i], FIELD_KEYS[f]);
                if (v && *v && !d->text[l][f]) d->text[l][f] = v;
            }
        }
    }
}

static void add_cuisines(Site *site, const JVal *cs) {
    if (!cs || cs->type != J_ARR) return;
    for (size_t i = 0; i < cs->len; i++) {
        const char *slug = json_str(&cs->items[i], "slug"), *name = json_str(&cs->items[i], "name");
        if (!slug || !name || site_cuisine(site, slug)) continue;
        if (site->ncuisines == site->ccap) {
            site->ccap = site->ccap ? site->ccap * 2 : 32;
            site->cuisines = realloc(site->cuisines, site->ccap * sizeof *site->cuisines);
            if (!site->cuisines) { fputs("Не хватает памяти\n", stderr); exit(1); }
        }
        site->cuisines[site->ncuisines++] = (Cuisine){slug, name, 0};
    }
}

/* Фото со свободной лицензией: путь к файлу, автор, лицензия, ссылка на источник */
static void add_photos(Site *site, const JVal *photos) {
    if (!photos || photos->type != J_OBJ) return;
    for (size_t i = 0; i < photos->len; i++) {
        Dish *d = (Dish *)site_dish(site, photos->keys[i]);
        const JVal *p = &photos->items[i];
        const char *image = json_str(p, "image");
        if (!d || d->image || !image || image[0] != '/') continue;
        d->image = image;
        d->photo_author = json_str(p, "author");
        d->photo_license = json_str(p, "license");
        d->photo_license_url = json_str(p, "licenseUrl");
        d->photo_source = json_str(p, "source");
        const JVal *review = json_get(p, "review");
        d->photo_review = review && review->type == J_BOOL && review->b;
    }
}

static void append_folded(Buf *b, const char *s) {
    if (!s) return;
    char *f = utf8_fold(s);
    buf_puts(b, f);
    buf_puts(b, "\n");
    free(f);
}

int site_load(Site *site, const char *dir) {
    char path[1024];
    snprintf(path, sizeof path, "%s/dishes.json", dir);
    JVal *main = load_json(path, 1);
    if (!main) return 0;
    snprintf(path, sizeof path, "%s/dishes-extra.json", dir);
    JVal *extra = load_json(path, 0);
    snprintf(path, sizeof path, "%s/photos.json", dir);
    JVal *photos = load_json(path, 0);

    add_cuisines(site, json_get(main, "cuisines"));
    if (extra) add_cuisines(site, json_get(extra, "cuisines"));
    add_dishes(site, json_get(main, "dishes"));
    if (extra) {
        add_dishes(site, json_get(extra, "dishes"));
        add_translations(site, dir);
        add_names(site, json_get(extra, "names"));
        /* Тексты, дописанные для старых блюд: заполняют только пустые поля */
        const JVal *sup = json_get(extra, "supplements");
        if (sup && sup->type == J_OBJ)
            for (size_t i = 0; i < sup->len; i++) {
                Dish *d = (Dish *)site_dish(site, sup->keys[i]);
                const JVal *m = &sup->items[i];
                if (!d || m->type != J_OBJ) continue;
                for (size_t k = 0; k < m->len; k++) {
                    int lang = lang_find(m->keys[k]);
                    for (int f = 0; f < F_COUNT; f++) {
                        const char *v = json_str(&m->items[k], FIELD_KEYS[f]);
                        if (v && *v && !d->text[lang][f]) d->text[lang][f] = v;
                    }
                }
            }
        /* Аллергены, дописанные вручную для старых блюд */
        const JVal *al = json_get(extra, "allergens");
        if (al && al->type == J_OBJ)
            for (size_t i = 0; i < al->len; i++) {
                Dish *d = (Dish *)site_dish(site, al->keys[i]);
                if (d && !d->allergens) d->allergens = allergens_from_codes(&al->items[i]);
            }
    }

    add_photos(site, photos);

    for (size_t i = 0; i < site->ndishes; i++) {
        Dish *d = &site->dishes[i];
        Buf h = {0};
        for (int l = 0; l < NLANGS; l++) {
            append_folded(&h, d->text[l][F_NAME]);
            append_folded(&h, d->text[l][F_DESCRIPTION]);
            append_folded(&h, d->text[l][F_INGREDIENTS]);
        }
        Cuisine *c = (Cuisine *)site_cuisine(site, d->cuisine);
        if (c) {
            append_folded(&h, c->name);
            c->count++;
        }
        d->haystack = h.p ? h.p : calloc(1, 1);
    }

    /* Редиректы старых пустых карточек на каталог больше не нужны, если блюдо появилось */
    const JVal *rs = json_get(main, "redirects");
    if (rs && rs->type == J_ARR) {
        site->redirects = calloc(rs->len ? rs->len : 1, sizeof *site->redirects);
        for (size_t i = 0; i < rs->len; i++) {
            const char *src = json_str(&rs->items[i], "source"), *dst = json_str(&rs->items[i], "destination");
            if (!src || !dst) continue;
            if (!strncmp(src, "/bliuda/", 8) && !strcmp(dst, "/dishes") && site_dish(site, src + 8)) continue;
            site->redirects[site->nredirects++] = (Redirect){src, dst};
        }
    }
    /* Деревья JSON живут до конца работы: строки блюд указывают прямо в них */
    return site->ndishes > 0;
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

const char *dish_get(const Dish *d, int lang, Field field, int *from) {
    int order[3] = {lang, LANG_EN, LANG_RU};
    for (int i = 0; i < 3; i++)
        if (d->text[order[i]][field]) {
            if (from) *from = order[i];
            return d->text[order[i]][field];
        }
    if (from) *from = lang;
    return NULL;
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
        else if (cp >= 0x400 && cp <= 0x40F) cp += 0x50;              /* Ѐ–Џ, в том числе Ё и Є, І, Ї */
        else if (cp >= 0xC0 && cp <= 0xDE && cp != 0xD7) cp += 0x20; /* À–Þ */
        else if (cp == 0x130) cp = 'i';                               /* турецкая İ */
        else if (cp >= 0x531 && cp <= 0x556) cp += 0x30;              /* армянские заглавные */
        else if (cp == 0x18F) cp = 0x259;                             /* азербайджанская Ə */
        if (cp == 0x451) cp = 0x435;                                  /* ё → е */
        encode(&b, cp);
    }
    if (!b.p) buf_puts(&b, "");
    return b.p;
}

/* Грубое отсечение окончания: «тыква» → «тыкв», «супы» → «суп», чтобы находить и «тыквой» */
static size_t stem_len(const char *w, size_t len) {
    static const char *const ENDINGS[] = {"а", "я", "о", "е", "ы", "и", "у", "ю", "й", "ь", "s", NULL};
    for (int round = 0; round < 2; round++) {
        int cut = 0;
        for (int i = 0; ENDINGS[i]; i++) {
            size_t el = strlen(ENDINGS[i]);
            /* Корень оставляем не короче трёх кириллических букв */
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
    if (d->allergens & f->exclude) return 0;
    return 1;
}
