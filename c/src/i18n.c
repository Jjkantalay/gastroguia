#include "i18n.h"

#include <stdio.h>
#include <string.h>

const Labels LABELS[LANG_COUNT] = {
    [LANG_RU] = {
        "ru", "ru",
        "Главная", "Блюда", "Контакты", "Меню", "Поиск блюд",
        "Все блюда", "листай влево и смотри все блюда", "жми и смотри все блюда",
        "Найти блюдо", "по названию, ингредиенту или кухне", "Найти", "название, ингредиент или описание",
        "найдено", "любая кухня", "любой тип", "без глютена", "без лактозы", "без сахара", "Показать",
        "Ничего не нашлось — попробуйте убрать часть фильтров.",
        "Ингредиенты", "Аллергены", "Историческая справка", "Вам также может понравиться", "Пока не указаны.",
        "блюда",
        "твой виртуальный гид в мире кавказской кухни", "Мультилингвальная картотека", "Все права защищены",
        "Страница не найдена", "Возможно, блюдо переехало. Загляните в каталог.",
        "Гастрогид — твой виртуальный гид в мире кавказской кухни",
        "Мультилингвальная картотека блюд Кавказа: история, ингредиенты, аллергены и традиции подачи.",
    },
    [LANG_EN] = {
        "en", "en",
        "Home", "Dishes", "Contacts", "Menu", "Search dishes",
        "All dishes", "swipe left to see all dishes", "tap to see all dishes",
        "Find a dish", "by name, ingredient or cuisine", "Search", "name, ingredient or description",
        "found", "any cuisine", "any type", "gluten-free", "lactose-free", "sugar-free", "Show",
        "Nothing found — try removing some filters.",
        "Ingredients", "Allergens", "Historical background", "You may also like", "Not specified yet.",
        "dishes",
        "your virtual guide to Caucasian cuisine", "Multilingual catalogue", "All rights reserved",
        "Page not found", "The dish may have moved. Have a look at the catalogue.",
        "Gastroguia — your virtual guide to Caucasian cuisine",
        "A multilingual catalogue of Caucasian dishes: history, ingredients, allergens and serving traditions.",
    },
    [LANG_ES] = {
        "es", "es",
        "Inicio", "Platos", "Contactos", "Menú", "Buscar platos",
        "Todos los platos", "desliza a la izquierda para ver todos los platos", "pulsa para ver todos los platos",
        "Buscar un plato", "por nombre, ingrediente o cocina", "Buscar", "nombre, ingrediente o descripción",
        "encontrados", "cualquier cocina", "cualquier tipo", "sin gluten", "sin lactosa", "sin azúcar", "Mostrar",
        "No se encontró nada: prueba a quitar algunos filtros.",
        "Ingredientes", "Alérgenos", "Reseña histórica", "También te puede gustar", "Aún no especificados.",
        "platos",
        "tu guía virtual de la cocina caucásica", "Catálogo multilingüe", "Todos los derechos reservados",
        "Página no encontrada", "Puede que el plato se haya movido. Echa un vistazo al catálogo.",
        "Gastroguía — tu guía virtual de la cocina caucásica",
        "Catálogo multilingüe de platos del Cáucaso: historia, ingredientes, alérgenos y tradiciones.",
    },
};

Lang lang_parse(const char *code) {
    if (code && !strcmp(code, "en")) return LANG_EN;
    if (code && !strcmp(code, "es")) return LANG_ES;
    return LANG_RU;
}

static const struct {
    const char *slug, *en, *es;
} CUISINES[] = {
    {"armyanskaya", "Armenian cuisine", "Cocina armenia"},
    {"gruzinskaya", "Georgian cuisine", "Cocina georgiana"},
    {"azerbajdzhanskaya", "Azerbaijani cuisine", "Cocina azerbaiyana"},
    {"chechenskaya", "Chechen cuisine", "Cocina chechena"},
    {"abhazskaya", "Abkhazian cuisine", "Cocina abjasia"},
    {"avarskaya", "Avar cuisine", "Cocina ávara"},
    {"vajnahskaya", "Vainakh cuisine", "Cocina vainaj"},
    {"ingushskaya", "Ingush cuisine", "Cocina ingush"},
    {"kabardinskaya", "Kabardian cuisine", "Cocina kabardina"},
    {"lezginskaya", "Lezgin cuisine", "Cocina lezguina"},
    {"osetinskaya", "Ossetian cuisine", "Cocina osetia"},
    {"cherkesskaya", "Circassian cuisine", "Cocina circasiana"},
};

const char *cuisine_title(const char *slug, const char *ru_name, Lang lang, char *out, size_t outlen) {
    if (lang != LANG_RU && slug)
        for (size_t i = 0; i < sizeof CUISINES / sizeof *CUISINES; i++)
            if (!strcmp(CUISINES[i].slug, slug)) return lang == LANG_EN ? CUISINES[i].en : CUISINES[i].es;
    snprintf(out, outlen, "%s кухня", ru_name ? ru_name : "");
    return out;
}

static const struct {
    const char *ru, *en, *es;
} COURSES[] = {
    {"закуска", "starter", "entrante"}, {"салат", "salad", "ensalada"},     {"суп", "soup", "sopa"},
    {"основное", "main", "principal"},  {"гарнир", "side", "guarnición"},   {"выпечка", "baking", "horneado"},
    {"десерт", "dessert", "postre"},    {"напиток", "drink", "bebida"},     {"соус", "sauce", "salsa"},
};

const char *course_title(const char *course, Lang lang) {
    if (!course) return NULL;
    for (size_t i = 0; i < sizeof COURSES / sizeof *COURSES; i++)
        if (!strcmp(COURSES[i].ru, course)) return lang == LANG_EN ? COURSES[i].en : lang == LANG_ES ? COURSES[i].es : COURSES[i].ru;
    return course;
}

/* Список типов блюд для фильтра каталога */
const char *const COURSE_VALUES[] = {"закуска", "салат", "суп", "основное", "гарнир", "выпечка", "десерт", "напиток", "соус", NULL};
