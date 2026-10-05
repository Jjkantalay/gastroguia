import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

// Размерность эмбеддингов (например, voyage-3.5 даёт 1024).
export const EMBEDDING_DIMENSIONS = 1024;

export const COURSES = [
  "закуска",
  "салат",
  "суп",
  "основное",
  "гарнир",
  "выпечка",
  "десерт",
  "напиток",
  "соус",
] as const;
export type Course = (typeof COURSES)[number];

export const cuisines = pgTable("cuisines", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
});

export const dishes = pgTable(
  "dishes",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    originalName: text("original_name"),
    description: text("description").notNull(),
    cuisineId: integer("cuisine_id").references(() => cuisines.id),
    course: text("course").$type<Course>().notNull(),
    cookingTimeMin: integer("cooking_time_min"),
    difficulty: integer("difficulty"), // 1 — легко, 2 — средне, 3 — сложно
    servings: integer("servings"),
    // КБЖУ на порцию, приблизительно
    calories: integer("calories"),
    protein: real("protein"),
    fat: real("fat"),
    carbs: real("carbs"),
    vegetarian: boolean("vegetarian").notNull().default(false),
    vegan: boolean("vegan").notNull().default(false),
    glutenFree: boolean("gluten_free").notNull().default(false),
    spicy: boolean("spicy").notNull().default(false),
    steps: jsonb("steps").$type<string[]>().notNull().default([]),
    imageUrl: text("image_url"),
    // Полнотекстовый поиск по-русски: название весит больше описания
    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('russian', coalesce(name, '') || ' ' || coalesce(original_name, '')), 'A') || setweight(to_tsvector('russian', coalesce(description, '')), 'B')`,
    ),
    // Семантический поиск для агентов; заполняется отдельным скриптом
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dishes_search_idx").using("gin", t.search),
    index("dishes_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("dishes_cuisine_idx").on(t.cuisineId),
    index("dishes_course_idx").on(t.course),
  ],
);

export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const dishIngredients = pgTable(
  "dish_ingredients",
  {
    dishId: integer("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    amount: text("amount"),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.dishId, t.ingredientId] }),
    index("dish_ingredients_ingredient_idx").on(t.ingredientId),
  ],
);

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const dishTags = pgTable(
  "dish_tags",
  {
    dishId: integer("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.dishId, t.tagId] })],
);
