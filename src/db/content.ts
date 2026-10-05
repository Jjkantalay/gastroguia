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
