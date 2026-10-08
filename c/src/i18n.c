#include "i18n.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "buf.h"

Language LANGS[MAX_LANGS];
int NLANGS;

const char *const ALLERGEN_CODES[ALLERGEN_COUNT] = {"gluten", "lactose", "eggs", "nuts", "sugar", "sesame", "fish"};
const char *const COURSE_VALUES[] = {"закуска", "салат", "суп", "основное", "гарнир", "выпечка", "десерт", "напиток", "соус", NULL};

static const char *const LABEL_KEYS[K_COUNT] = {
    "home", "dishes", "contacts", "menu", "language", "search_dishes", "all_dishes", "swipe", "tap_cuisine",
    "find_title", "find_hint", "find_btn", "search_placeholder", "found", "any_cuisine", "any_course", "exclude",
    "show", "nothing", "ingredients", "allergens", "history", "also", "not_specified", "crumb_dishes", "tagline",
    "catalogue", "rights", "not_found", "not_found_hint", "site_title", "site_description", "brand", "in_english",
};

static char *read_all(const char *path) {
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

int i18n_load(const char *path) {
    char *text = read_all(path);
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
    const JVal *langs = json_get(root, "languages");
    if (!langs || langs->type != J_ARR) {
        fprintf(stderr, "В %s нет списка languages\n", path);
        return 0;
    }
    for (size_t i = 0; i < langs->len && NLANGS < MAX_LANGS; i++) {
        const JVal *o = &langs->items[i];
        Language *l = &LANGS[NLANGS];
        l->code = json_str(o, "code");
        l->name = json_str(o, "name");
        if (!l->code || !l->name) continue;
        const char *dir = json_str(o, "dir");
        l->rtl = dir && !strcmp(dir, "rtl");
        const JVal *labels = json_get(o, "labels");
        for (int k = 0; k < K_COUNT; k++) l->labels[k] = json_str(labels, LABEL_KEYS[k]);
        l->cuisines = json_get(o, "cuisines");
        l->courses = json_get(o, "courses");
        l->allergens = json_get(o, "allergens");
        NLANGS++;
    }
    if (NLANGS < 2 || strcmp(LANGS[LANG_RU].code, "ru") || strcmp(LANGS[LANG_EN].code, "en")) {
        fprintf(stderr, "В %s первым должен идти русский, вторым — английский\n", path);
        return 0;
    }
    for (int k = 0; k < K_COUNT; k++)
        if (!LANGS[LANG_RU].labels[k] || !LANGS[LANG_EN].labels[k]) {
            fprintf(stderr, "В %s нет подписи %s на русском или английском\n", path, LABEL_KEYS[k]);
            return 0;
        }
    return 1;
}

int lang_find(const char *code) {
    if (code)
        for (int i = 0; i < NLANGS; i++)
            if (!strcmp(LANGS[i].code, code)) return i;
    return LANG_RU;
}

const char *label(int lang, LabelKey key) {
    if (LANGS[lang].labels[key]) return LANGS[lang].labels[key];
    return LANGS[LANG_EN].labels[key] ? LANGS[LANG_EN].labels[key] : LANGS[LANG_RU].labels[key];
}

/* Значение из словаря языка, затем английского, затем русского */
static const char *lookup(int lang, size_t field, const char *key) {
    int order[3] = {lang, LANG_EN, LANG_RU};
    for (int i = 0; i < 3; i++) {
        const JVal *map = field == 0 ? LANGS[order[i]].cuisines : field == 1 ? LANGS[order[i]].courses : LANGS[order[i]].allergens;
        const char *v = json_str(map, key);
        if (v) return v;
    }
    return NULL;
}

const char *cuisine_label(int lang, const char *slug, const char *fallback) {
    const char *v = slug ? lookup(lang, 0, slug) : NULL;
    return v ? v : fallback;
}

const char *course_label(int lang, const char *course) {
    if (!course) return NULL;
    const char *v = lookup(lang, 1, course);
    return v ? v : course;
}

const char *allergen_label(int lang, int index) {
    const char *v = lookup(lang, 2, ALLERGEN_CODES[index]);
    return v ? v : ALLERGEN_CODES[index];
}
