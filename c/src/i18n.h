#ifndef I18N_H
#define I18N_H

#include <stddef.h>

#include "json.h"

/* Языки, подписи интерфейса, названия кухонь, типов блюд и аллергенов — из content/i18n.json.
   Первым в файле идёт русский, вторым английский: на них всё откатывается, если перевода нет. */

#define MAX_LANGS 32
#define LANG_RU 0
#define LANG_EN 1

typedef enum {
    K_HOME, K_DISHES, K_CONTACTS, K_MENU, K_LANGUAGE, K_SEARCH_DISHES, K_ALL_DISHES, K_SWIPE, K_TAP_CUISINE,
    K_FIND_TITLE, K_FIND_HINT, K_FIND_BTN, K_SEARCH_PLACEHOLDER, K_FOUND, K_ANY_CUISINE, K_ANY_COURSE, K_EXCLUDE,
    K_SHOW, K_NOTHING, K_INGREDIENTS, K_ALLERGENS, K_HISTORY, K_ALSO, K_NOT_SPECIFIED, K_CRUMB_DISHES, K_TAGLINE,
    K_CATALOGUE, K_RIGHTS, K_NOT_FOUND, K_NOT_FOUND_HINT, K_SITE_TITLE, K_SITE_DESCRIPTION, K_BRAND, K_IN_ENGLISH,
    K_PHOTO, K_COUNT
} LabelKey;

typedef struct {
    const char *code, *name;
    int rtl;
    const char *labels[K_COUNT];
    const JVal *cuisines, *courses, *allergens;
} Language;

extern Language LANGS[MAX_LANGS];
extern int NLANGS;

int i18n_load(const char *path);
/* Индекс языка по коду; неизвестный код — русский */
int lang_find(const char *code);
const char *label(int lang, LabelKey key);
const char *cuisine_label(int lang, const char *slug, const char *fallback);
const char *course_label(int lang, const char *course);

#define ALLERGEN_COUNT 7
extern const char *const ALLERGEN_CODES[ALLERGEN_COUNT];
const char *allergen_label(int lang, int index);
/* Типы блюд для фильтра каталога */
extern const char *const COURSE_VALUES[];

#endif
