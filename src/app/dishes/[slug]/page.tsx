import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DietBadges } from "@/components/DishCard";
import { DIFFICULTY_LABELS, formatTime, getDish } from "@/lib/dishes";

type Params = Promise<{ slug: string }>;

const loadDish = cache(getDish);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const dish = await loadDish((await params).slug);
  if (!dish) return {};
  return {
    title: `${dish.name} — рецепт`,
    description: dish.description,
    alternates: { canonical: `/dishes/${dish.slug}` },
  };
}

export default async function DishPage({ params }: { params: Params }) {
  const dish = await loadDish((await params).slug);
  if (!dish) notFound();

  // Разметка schema.org/Recipe для расширенных сниппетов в поиске
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: dish.name,
    description: dish.description,
    recipeCuisine: dish.cuisine?.name,
    recipeCategory: dish.course,
    recipeYield: dish.servings ? `${dish.servings} порц.` : undefined,
    totalTime: dish.cookingTimeMin ? `PT${dish.cookingTimeMin}M` : undefined,
    recipeIngredient: dish.ingredients.map((i) => [i.name, i.amount].filter(Boolean).join(" — ")),
    recipeInstructions: dish.steps.map((text) => ({ "@type": "HowToStep", text })),
    keywords: dish.tags.map((t) => t.name).join(", "),
    nutrition: dish.calories ? { "@type": "NutritionInformation", calories: `${dish.calories} ккал` } : undefined,
    image: dish.imageUrl ?? undefined,
  };

  const facts = [
    ["Время", formatTime(dish.cookingTimeMin)],
    ["Сложность", dish.difficulty ? DIFFICULTY_LABELS[dish.difficulty] : null],
    ["Порций", dish.servings],
    ["Калории", dish.calories ? `${dish.calories} ккал` : null],
    ["Б / Ж / У", dish.protein != null ? `${dish.protein} / ${dish.fat} / ${dish.carbs} г` : null],
  ].filter(([, v]) => v != null);

  return (
    <article className="flex flex-col gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          <Link href="/dishes" className="hover:text-accent">Блюда</Link>
          {dish.cuisine && (
            <>
              {" / "}
              <Link href={`/dishes?cuisine=${dish.cuisine.slug}`} className="hover:text-accent">{dish.cuisine.name} кухня</Link>
            </>
          )}
        </p>
        <h1 className="font-serif text-4xl font-semibold">{dish.name}</h1>
        {dish.originalName && <p className="text-muted">{dish.originalName}</p>}
        <p className="max-w-2xl text-lg">{dish.description}</p>
        <DietBadges dish={dish} />
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-line p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
        <section>
          <h2 className="mb-3 font-serif text-2xl font-semibold">Ингредиенты</h2>
          <ul className="flex flex-col divide-y divide-line">
            {dish.ingredients.map((i) => (
              <li key={i.name} className="flex justify-between gap-4 py-2 text-sm">
                <span>{i.name}</span>
                <span className="text-muted">{i.amount}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 font-serif text-2xl font-semibold">Приготовление</h2>
          <ol className="flex flex-col gap-4">
            {dish.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {i + 1}
                </span>
                <p className="pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {dish.tags.length > 0 && (
        <p className="text-sm text-muted">Теги: {dish.tags.map((t) => t.name).join(", ")}</p>
      )}
    </article>
  );
}
