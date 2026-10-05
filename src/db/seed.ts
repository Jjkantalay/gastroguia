import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { slugify } from "../lib/slug";
import * as schema from "./schema";
import { seedCuisines, seedDishes } from "./seed-data";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

// Повторный запуск обновляет данные, а не дублирует их
await db.transaction(async (tx) => {
  const cuisineIds = new Map<string, number>();
  for (const c of seedCuisines) {
    const [row] = await tx
      .insert(schema.cuisines)
      .values(c)
      .onConflictDoUpdate({
        target: schema.cuisines.slug,
        set: { name: c.name, description: c.description },
      })
      .returning({ id: schema.cuisines.id });
    cuisineIds.set(c.slug, row.id);
  }

  for (const d of seedDishes) {
    const cuisineId = cuisineIds.get(d.cuisine);
    if (!cuisineId) throw new Error(`Неизвестная кухня ${d.cuisine} у блюда ${d.slug}`);

    const values = {
      slug: d.slug,
      name: d.name,
      originalName: d.originalName ?? null,
      description: d.description,
      cuisineId,
      course: d.course,
      cookingTimeMin: d.cookingTimeMin,
      difficulty: d.difficulty,
      servings: d.servings,
      calories: d.calories,
      protein: d.protein,
      fat: d.fat,
      carbs: d.carbs,
      vegetarian: d.vegetarian ?? false,
      vegan: d.vegan ?? false,
      glutenFree: d.glutenFree ?? false,
      spicy: d.spicy ?? false,
      steps: d.steps,
    };
    const [dish] = await tx
      .insert(schema.dishes)
      .values(values)
      .onConflictDoUpdate({
        target: schema.dishes.slug,
        set: { ...values, updatedAt: sql`now()` },
      })
      .returning({ id: schema.dishes.id });

    await tx.delete(schema.dishIngredients).where(sql`${schema.dishIngredients.dishId} = ${dish.id}`);
    for (const [position, [name, amount]] of d.ingredients.entries()) {
      const [ing] = await tx
        .insert(schema.ingredients)
        .values({ slug: slugify(name), name })
        .onConflictDoUpdate({ target: schema.ingredients.slug, set: { name } })
        .returning({ id: schema.ingredients.id });
      await tx.insert(schema.dishIngredients).values({ dishId: dish.id, ingredientId: ing.id, amount, position });
    }

    await tx.delete(schema.dishTags).where(sql`${schema.dishTags.dishId} = ${dish.id}`);
    for (const name of d.tags) {
      const [tag] = await tx
        .insert(schema.tags)
        .values({ slug: slugify(name), name })
        .onConflictDoUpdate({ target: schema.tags.slug, set: { name } })
        .returning({ id: schema.tags.id });
      await tx.insert(schema.dishTags).values({ dishId: dish.id, tagId: tag.id });
    }
  }
});

await client.end();
console.log(`Загружено: кухонь ${seedCuisines.length}, блюд ${seedDishes.length}`);
