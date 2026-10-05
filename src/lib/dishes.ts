import { and, asc, desc, eq, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { COURSES, cuisines, dishes, dishIngredients, dishTags, ingredients, tags } from "@/db/schema";

// Один набор фильтров для сайта, REST API и инструментов агента
export const dishFiltersSchema = z.object({
  q: z.string().trim().max(200).describe("Свободный текстовый запрос: название, описание").optional(),
  cuisine: z.string().describe("Слаг кухни, например italyanskaya").optional(),
  course: z.enum(COURSES).describe("Тип блюда").optional(),
  vegetarian: z.boolean().optional(),
  vegan: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  spicy: z.boolean().describe("true — только острые, false — без острых").optional(),
  maxTimeMin: z.number().int().positive().describe("Максимальное время приготовления в минутах").optional(),
  maxCalories: z.number().int().positive().describe("Максимум калорий на порцию").optional(),
  withIngredients: z.array(z.string()).max(10).describe("Блюдо должно содержать все эти ингредиенты").optional(),
  withoutIngredients: z.array(z.string()).max(10).describe("Блюдо не должно содержать эти ингредиенты").optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});
export type DishFilters = z.input<typeof dishFiltersSchema>;

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function hasIngredient(name: string) {
  return sql`exists (
    select 1 from ${dishIngredients}
    join ${ingredients} on ${ingredients.id} = ${dishIngredients.ingredientId}
    where ${dishIngredients.dishId} = ${dishes.id}
      and ${ingredients.name} ilike ${"%" + escapeLike(name) + "%"}
  )`;
}

export async function searchDishes(input: DishFilters = {}) {
  const f = dishFiltersSchema.parse(input);
  const where: (SQL | undefined)[] = [];

  const tsQuery = f.q ? sql`websearch_to_tsquery('russian', ${f.q})` : undefined;
  if (f.q && tsQuery) {
    where.push(or(sql`${dishes.search} @@ ${tsQuery}`, ilike(dishes.name, `%${escapeLike(f.q)}%`)));
  }
  if (f.cuisine) where.push(eq(cuisines.slug, f.cuisine));
  if (f.course) where.push(eq(dishes.course, f.course));
  if (f.vegetarian !== undefined) where.push(eq(dishes.vegetarian, f.vegetarian));
  if (f.vegan !== undefined) where.push(eq(dishes.vegan, f.vegan));
  if (f.glutenFree !== undefined) where.push(eq(dishes.glutenFree, f.glutenFree));
  if (f.spicy !== undefined) where.push(eq(dishes.spicy, f.spicy));
  if (f.maxTimeMin) where.push(lte(dishes.cookingTimeMin, f.maxTimeMin));
  if (f.maxCalories) where.push(lte(dishes.calories, f.maxCalories));
  for (const name of f.withIngredients ?? []) where.push(hasIngredient(name));
  for (const name of f.withoutIngredients ?? []) where.push(sql`not ${hasIngredient(name)}`);

  const order = tsQuery ? [desc(sql`ts_rank(${dishes.search}, ${tsQuery})`), asc(dishes.name)] : [asc(dishes.name)];

  return db
    .select({
      slug: dishes.slug,
      name: dishes.name,
      originalName: dishes.originalName,
      description: dishes.description,
      cuisine: cuisines.name,
      cuisineSlug: cuisines.slug,
      course: dishes.course,
      cookingTimeMin: dishes.cookingTimeMin,
      difficulty: dishes.difficulty,
      calories: dishes.calories,
      vegetarian: dishes.vegetarian,
      vegan: dishes.vegan,
      glutenFree: dishes.glutenFree,
      spicy: dishes.spicy,
      imageUrl: dishes.imageUrl,
    })
    .from(dishes)
    .leftJoin(cuisines, eq(cuisines.id, dishes.cuisineId))
    .where(and(...where))
    .orderBy(...order)
    .limit(f.limit)
    .offset(f.offset);
}

export type DishSummary = Awaited<ReturnType<typeof searchDishes>>[number];

export async function getDish(slug: string) {
  const [dish] = await db
    .select({
      dish: dishes,
      cuisine: { name: cuisines.name, slug: cuisines.slug },
    })
    .from(dishes)
    .leftJoin(cuisines, eq(cuisines.id, dishes.cuisineId))
    .where(eq(dishes.slug, slug))
    .limit(1);
  if (!dish) return null;

  const [ingredientRows, tagRows] = await Promise.all([
    db
      .select({ name: ingredients.name, amount: dishIngredients.amount })
      .from(dishIngredients)
      .innerJoin(ingredients, eq(ingredients.id, dishIngredients.ingredientId))
      .where(eq(dishIngredients.dishId, dish.dish.id))
      .orderBy(asc(dishIngredients.position)),
    db
      .select({ name: tags.name, slug: tags.slug })
      .from(dishTags)
      .innerJoin(tags, eq(tags.id, dishTags.tagId))
      .where(eq(dishTags.dishId, dish.dish.id))
      .orderBy(asc(tags.name)),
  ]);

  // Эмбеддинг и служебные поля наружу не отдаём
  const { embedding: _e, search: _s, id: _id, cuisineId: _c, ...rest } = dish.dish;
  return { ...rest, cuisine: dish.cuisine, ingredients: ingredientRows, tags: tagRows };
}

export type DishDetails = NonNullable<Awaited<ReturnType<typeof getDish>>>;

export async function listCuisines() {
  return db
    .select({
      slug: cuisines.slug,
      name: cuisines.name,
      description: cuisines.description,
      dishCount: sql<number>`count(${dishes.id})::int`,
    })
    .from(cuisines)
    .leftJoin(dishes, eq(dishes.cuisineId, cuisines.id))
    .groupBy(cuisines.id)
    .orderBy(asc(cuisines.name));
}

export const DIFFICULTY_LABELS: Record<number, string> = { 1: "легко", 2: "средне", 3: "сложно" };

export function formatTime(min: number | null) {
  if (!min) return null;
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
