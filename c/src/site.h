#ifndef SITE_H
#define SITE_H

#include <stddef.h>

#include "i18n.h"

typedef enum { F_NAME, F_DESCRIPTION, F_QUOTE, F_HISTORY, F_INGREDIENTS, F_COUNT } Field;

typedef struct {
    const char *slug, *cuisine, *course, *image;
    unsigned allergens;                       /* биты по ALLERGEN_CODES */
    /* Автор и лицензия фото из content/photos.json; NULL — своё фото сайта */
    const char *photo_author, *photo_license, *photo_license_url, *photo_source;
    const char *text[MAX_LANGS][F_COUNT];     /* тексты по языкам; NULL — нет перевода */
    char *haystack;                           /* все тексты в нижнем регистре, для поиска */
} Dish;

typedef struct {
    const char *slug, *name;
    int count;
} Cuisine;

typedef struct {
    const char *source, *destination;
} Redirect;

typedef struct {
    Dish *dishes;
    size_t ndishes, cap;
    Cuisine *cuisines;
    size_t ncuisines, ccap;
    Redirect *redirects;
    size_t nredirects;
} Site;

/* Читает dishes.json (перенос с WordPress), dishes-extra.json (новые блюда, кухни и названия на других языках)
   и photos.json (фото со свободной лицензией, если есть) */
int site_load(Site *site, const char *content_dir);
const Dish *site_dish(const Site *site, const char *slug);
const Cuisine *site_cuisine(const Site *site, const char *slug);

/* Поле на нужном языке; если перевода нет — английское, затем русское. В *from — язык, откуда взято */
const char *dish_get(const Dish *d, int lang, Field field, int *from);

char *utf8_fold(const char *s);

typedef struct {
    const char *q, *cuisine, *course;
    unsigned exclude; /* аллергены, которых не должно быть */
} Filter;

int dish_matches(const Dish *d, const Filter *f, const char *folded_q);

#endif
