CREATE TABLE "dish_translations" (
	"dish_id" integer NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"ingredients_text" text,
	"allergens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quote" text,
	"history" text,
	CONSTRAINT "dish_translations_dish_id_locale_pk" PRIMARY KEY("dish_id","locale")
);
--> statement-breakpoint
ALTER TABLE "dishes" ALTER COLUMN "course" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "ingredients_text" text;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "allergens" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "quote" text;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "history" text;--> statement-breakpoint
ALTER TABLE "dishes" drop column "search";--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce(name, '') || ' ' || coalesce(original_name, '')), 'A') || setweight(to_tsvector('russian', coalesce(description, '')), 'B') || setweight(to_tsvector('russian', coalesce(ingredients_text, '')), 'C')) STORED;--> statement-breakpoint
CREATE INDEX "dishes_search_idx" ON "dishes" USING gin ("search");
--> statement-breakpoint
ALTER TABLE "dish_translations" ADD CONSTRAINT "dish_translations_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;