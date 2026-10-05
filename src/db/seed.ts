import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { slugify } from "../lib/slug";
import type { ContentFile } from "./content";
import * as schema from "./schema";

// Загружает content/dishes.json в базу. Повторный запуск обновляет данные, а не дублирует их.
const content: ContentFile = JSON.parse(readFileSync(new URL("../../content/dishes.json", import.meta.url), "utf8"));

const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema });

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

await client.end();
console.log(`Загружено: кухонь ${content.cuisines.length}, блюд ${content.dishes.length}`);
