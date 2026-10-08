import type { Course, Locale } from "./schema";

// Формат content/dishes.json — контент, перенесённый со старого сайта

export type ContentTranslation = {
  name: string;
  description: string;
  quote: string | null;
  history: string | null;
  ingredientsText: string | null;
  allergens: string[];
};

export type ContentDish = ContentTranslation & {
  slug: string;
  legacySlugs: string[];
  wpIds: number[];
  cuisine: string | null;
  course: Course | null;
  ingredients: [name: string, amount: string][];
  image: string | null;
  translations: Partial<Record<Locale, ContentTranslation>>;
};

export type ContentFile = {
  source: string;
  cuisines: { slug: string; name: string }[];
  dishes: ContentDish[];
  skipped: { wpId: number; slug: string; title: string; reason: string }[];
  redirects: { source: string; destination: string }[];
};

// Формат content/dishes-extra.json — блюда, добавленные после переноса, и названия на других языках
type ExtraTexts = { name: string; description: string; history: string; ingredientsText: string };
export type ExtraFile = {
  cuisines?: { slug: string; name: string }[];
  dishes: (ExtraTexts & {
    slug: string;
    cuisine: string;
    course: Course;
    allergenCodes: string[];
    translations: { en: ExtraTexts };
  })[];
  allergens: Record<string, string[]>;
  supplements: Record<string, Partial<Record<"ru" | "en", { history?: string }>>>;
  names: Record<string, Record<string, string>>;
};

type I18nFile = { languages: { code: string; allergens: Record<string, string> }[] };

// Формат content/photos.json — фото со свободной лицензией и их авторы
export type PhotoCredit = {
  image: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  source: string;
  original?: string; // адрес файла на Wikimedia Commons — по нему WordPress скачивает фото при импорте
  review?: boolean;
};
export type PhotosFile = Record<string, PhotoCredit>;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* Объединяет перенесённые блюда с добавленными: русский и английский тексты, аллергены словами */
export function mergeContent(main: ContentFile, extra: ExtraFile, i18n: I18nFile, photos: PhotosFile = {}): ContentFile {
  const words = (lang: "ru" | "en", codes: string[]) => {
    const dict = i18n.languages.find((l) => l.code === lang)?.allergens ?? {};
    return codes.map((c) => capitalize(dict[c] ?? c));
  };
  const known = new Set(extra.dishes.map((d) => d.slug));

  const old = main.dishes.map((d) => {
    const sup = extra.supplements[d.slug];
    const codes = extra.allergens[d.slug];
    const en = d.translations.en;
    return {
      ...d,
      history: d.history ?? sup?.ru?.history ?? null,
      allergens: d.allergens.length ? d.allergens : words("ru", codes ?? []),
      translations: {
        ...d.translations,
        ...(en ? { en: { ...en, history: en.history ?? sup?.en?.history ?? null } } : {}),
      },
    };
  });

  const added: ContentDish[] = extra.dishes.map((d) => ({
    slug: d.slug,
    legacySlugs: [],
    wpIds: [],
    name: d.name,
    description: d.description,
    quote: null,
    history: d.history,
    ingredientsText: d.ingredientsText,
    allergens: words("ru", d.allergenCodes),
    cuisine: d.cuisine,
    course: d.course,
    ingredients: [],
    image: null,
    translations: {
      en: { ...d.translations.en, quote: null, allergens: words("en", d.allergenCodes) },
    },
  }));

  const photo = (d: ContentDish) => d.image ?? (photos[d.slug]?.image.startsWith("/") ? photos[d.slug].image : null);
  return {
    ...main,
    cuisines: [...main.cuisines, ...(extra.cuisines ?? []).filter((c) => !main.cuisines.some((m) => m.slug === c.slug))],
    dishes: [...old, ...added].map((d) => ({ ...d, image: photo(d) })),
    // Редиректы пустых карточек на каталог не нужны, если блюдо появилось
    redirects: main.redirects.filter((r) => !(r.destination === "/dishes" && known.has(r.source.replace("/bliuda/", "")))),
  };
}
