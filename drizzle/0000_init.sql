CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "cuisines" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "cuisines_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "dish_ingredients" (
	"dish_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"amount" text,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dish_ingredients_dish_id_ingredient_id_pk" PRIMARY KEY("dish_id","ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "dish_tags" (
	"dish_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "dish_tags_dish_id_tag_id_pk" PRIMARY KEY("dish_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "dishes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"original_name" text,
	"description" text NOT NULL,
	"cuisine_id" integer,
	"course" text NOT NULL,
	"cooking_time_min" integer,
	"difficulty" integer,
	"servings" integer,
	"calories" integer,
	"protein" real,
	"fat" real,
	"carbs" real,
	"vegetarian" boolean DEFAULT false NOT NULL,
	"vegan" boolean DEFAULT false NOT NULL,
	"gluten_free" boolean DEFAULT false NOT NULL,
	"spicy" boolean DEFAULT false NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_url" text,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce(name, '') || ' ' || coalesce(original_name, '')), 'A') || setweight(to_tsvector('russian', coalesce(description, '')), 'B')) STORED,
	"embedding" vector(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dishes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "ingredients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_tags" ADD CONSTRAINT "dish_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_cuisine_id_cuisines_id_fk" FOREIGN KEY ("cuisine_id") REFERENCES "public"."cuisines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dish_ingredients_ingredient_idx" ON "dish_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "dishes_search_idx" ON "dishes" USING gin ("search");--> statement-breakpoint
CREATE INDEX "dishes_embedding_idx" ON "dishes" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "dishes_cuisine_idx" ON "dishes" USING btree ("cuisine_id");--> statement-breakpoint
CREATE INDEX "dishes_course_idx" ON "dishes" USING btree ("course");