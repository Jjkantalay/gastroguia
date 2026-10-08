#ifndef SITE_H
#define SITE_H

#include <stddef.h>

#include "buf.h"

typedef enum { LANG_RU, LANG_EN, LANG_ES, LANG_COUNT } Lang;

#define MAX_ALLERGENS 8

/* Тексты блюда на одном языке */
typedef struct {
    const char *name, *description, *quote, *history, *ingredients;
    const char *allergens[MAX_ALLERGENS];
    int nallergens;
} DishText;

typedef struct {
    const char *slug, *cuisine, *course, *image;
    DishText text[LANG_COUNT];
    int has[LANG_COUNT];
    char *haystack; /* все тексты в нижнем регистре, для поиска */
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
    size_t ndishes;
    Cuisine *cuisines;
    size_t ncuisines;
    Redirect *redirects;
    size_t nredirects;
} Site;

int site_load(Site *site, const char *path);
const Dish *site_dish(const Site *site, const char *slug);
const Cuisine *site_cuisine(const Site *site, const char *slug);
/* Тексты на нужном языке; если перевода нет — русские */
const DishText *dish_text(const Dish *d, Lang lang);

/* Нижний регистр для латиницы, кириллицы и испанских букв; «ё» → «е». Результат освобождает вызывающий */
char *utf8_fold(const char *s);

/* Фильтры каталога */
typedef struct {
    const char *q, *cuisine, *course;
    int no_gluten, no_lactose, no_sugar;
} Filter;

int dish_matches(const Dish *d, const Filter *f, const char *folded_q);

#endif
