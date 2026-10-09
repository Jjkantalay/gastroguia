import { existsSync, readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { slugify } from "../lib/slug";
import { connect } from "./client";
import { mergeContent, type ContentFile, type TranslationsFile } from "./content";
import * as schema from "./schema";

// Загружает content/dishes.json и content/dishes-extra.json в базу. Повторный запуск обновляет данные, а не дублирует их.
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../content/${name}`, import.meta.url), "utf8"));
const photosUrl = new URL("../../content/photos.json", import.meta.url);
const photos = existsSync(photosUrl) ? read("photos.json") : {};
const translations: Partial<Record<schema.Locale, TranslationsFile>> = {};
for (const locale of schema.LOCALES) {
  const url = new URL(`../../content/translations/${locale}.json`, import.meta.url);
  if (existsSync(url)) translations[locale] = read(`translations/${locale}.json`);
}
const content: ContentFile = mergeContent(read("dishes.json"), read("dishes-extra.json"), read("i18n.json"), photos, translations);

// Подхватываем .env при локальном запуске; в Docker переменные приходят из окружения
try {
  process.loadEnvFile();
} catch {}

const { db, close } = connect(undefined, { poolSize: 1 });

await db.transaction(async (tx) => {
  const cuisineIds = new Map<string, number>();
  for (const c of content.cuisines) {
    const [row] = await tx
      .insert(schema.cuisines)
      .values(c)
      .onConflictDoUpdate({ target: schema.cuisines.slug, set: { name: c.name } })
      .returning({ id: schema.cuisines.id });
    cuisineIds.set(c.slug, row.id);
  }

  for (const d of content.dishes) {
    const cuisineId = d.cuisine ? cuisineIds.get(d.cuisine) : undefined;
    if (d.cuisine && !cuisineId) throw new Error(`Неизвестная кухня ${d.cuisine} у блюда ${d.slug}`);

    const values = {
      slug: d.slug,
      name: d.name,
      description: d.description,
      cuisineId: cuisineId ?? null,
      course: d.course,
      quote: d.quote,
      history: d.history,
      ingredientsText: d.ingredientsText,
      allergens: d.allergens,
      // Пометка «без глютена» только там, где аллергены указаны явно и глютена среди них нет
      glutenFree: d.allergens.length > 0 && !d.allergens.some((a) => /глютен/i.test(a)),
      imageUrl: d.image,
    };
    const [dish] = await tx
      .insert(schema.dishes)
      .values(values)
      .onConflictDoUpdate({ target: schema.dishes.slug, set: { ...values, updatedAt: sql`now()` } })
      .returning({ id: schema.dishes.id });

    await tx.delete(schema.dishTranslations).where(eq(schema.dishTranslations.dishId, dish.id));
    for (const [locale, t] of Object.entries(d.translations)) {
      await tx.insert(schema.dishTranslations).values({ dishId: dish.id, locale: locale as schema.Locale, ...t });
    }

    await tx.delete(schema.dishIngredients).where(eq(schema.dishIngredients.dishId, dish.id));
    for (const [position, [name, amount]] of d.ingredients.entries()) {
      const [ing] = await tx
        .insert(schema.ingredients)
        .values({ slug: slugify(name), name })
        .onConflictDoUpdate({ target: schema.ingredients.slug, set: { name } })
        .returning({ id: schema.ingredients.id });
      await tx
        .insert(schema.dishIngredients)
        .values({ dishId: dish.id, ingredientId: ing.id, amount, position })
        .onConflictDoNothing();
    }
  }
});

await close();
console.log(`Загружено: кухонь ${content.cuisines.length}, блюд ${content.dishes.length}`);
