#ifndef I18N_H
#define I18N_H

#include "site.h"

/* Подписи интерфейса на трёх языках сайта */
typedef struct {
    const char *code, *html_lang;
    const char *home, *dishes, *contacts, *menu, *search_dishes;
    const char *all_dishes, *swipe, *tap_cuisine;
    const char *find_title, *find_hint, *find_btn, *search_placeholder;
    const char *found, *any_cuisine, *any_course, *no_gluten, *no_lactose, *no_sugar, *show, *nothing;
    const char *ingredients, *allergens, *history, *also, *not_specified, *crumb_dishes;
    const char *tagline, *catalogue, *rights;
    const char *not_found, *not_found_hint, *site_title, *site_description;
} Labels;

extern const Labels LABELS[LANG_COUNT];

Lang lang_parse(const char *code);
/* «Армянская кухня» / «Armenian cuisine» / «Cocina armenia» */
const char *cuisine_title(const char *slug, const char *ru_name, Lang lang, char *out, size_t outlen);
const char *course_title(const char *course, Lang lang);
extern const char *const COURSE_VALUES[];

#endif
