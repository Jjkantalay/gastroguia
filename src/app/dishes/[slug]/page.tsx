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
    title: dish.cuisine ? `${dish.name} — ${dish.cuisine.name.toLowerCase()} кухня` : dish.name,
    description: dish.description,
    alternates: { canonical: `/dishes/${dish.slug}` },
    openGraph: dish.imageUrl ? { images: [dish.imageUrl] } : undefined,
  };
}

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">{p}</p>
      ))}
    </div>
  );
}

export default async function DishPage({ params }: { params: Params }) {
  const dish = await loadDish((await params).slug);
  if (!dish) notFound();

  const hasRecipe = dish.steps.length > 0;
  const ingredientLines = dish.ingredients.map((i) => [i.name, i.amount].filter(Boolean).join(" — "));

  // Разметка schema.org для поисковиков: Recipe, если есть шаги, иначе описание блюда
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": hasRecipe ? "Recipe" : "Article",
    name: dish.name,
    headline: dish.name,
    description: dish.description,
    image: dish.imageUrl ?? undefined,
    ...(hasRecipe
      ? {
          recipeCuisine: dish.cuisine?.name,
          recipeCategory: dish.course ?? undefined,
          recipeYield: dish.servings ? `${dish.servings} порц.` : undefined,
          totalTime: dish.cookingTimeMin ? `PT${dish.cookingTimeMin}M` : undefined,
          recipeIngredient: ingredientLines.length ? ingredientLines : undefined,
          recipeInstructions: dish.steps.map((text) => ({ "@type": "HowToStep", text })),
          nutrition: dish.calories ? { "@type": "NutritionInformation", calories: `${dish.calories} ккал` } : undefined,
        }
      : {}),
  };

  const facts = [
    ["Кухня", dish.cuisine?.name],
    ["Тип", dish.course],
    ["Время", formatTime(dish.cookingTimeMin)],
    ["Сложность", dish.difficulty ? DIFFICULTY_LABELS[dish.difficulty] : null],
    ["Порций", dish.servings],
    ["Калории", dish.calories ? `${dish.calories} ккал` : null],
    ["Б / Ж / У", dish.protein != null ? `${dish.protein} / ${dish.fat} / ${dish.carbs} г` : null],
  ].filter(([, v]) => v != null);

  return (
    <article className="flex flex-col gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="grid gap-6 md:grid-cols-[3fr_2fr] md:items-start">
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
          <p className="text-lg">{dish.description}</p>
          <DietBadges dish={dish} />
        </header>
        {dish.imageUrl && (
          // Фото переносятся со старого сайта как есть, поэтому обычный img
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dish.imageUrl} alt={dish.name} className="aspect-[4/3] w-full rounded-xl border border-line object-cover" />
        )}
      </div>

      {dish.quote && (
        <blockquote className="border-l-4 border-accent pl-4 font-serif text-xl italic">«{dish.quote}»</blockquote>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-line p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div className={hasRecipe ? "grid gap-8 md:grid-cols-[1fr_2fr]" : "grid gap-8 md:grid-cols-2"}>
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl font-semibold">Ингредиенты</h2>
          {dish.ingredients.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {dish.ingredients.map((i) => (
                <li key={i.name} className="flex justify-between gap-4 py-2 text-sm">
                  <span>{i.name}</span>
                  <span className="text-muted">{i.amount}</span>
                </li>
              ))}
            </ul>
          ) : dish.ingredientsText ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{dish.ingredientsText}</p>
          ) : (
            <p className="text-sm text-muted">Пока не указаны.</p>
          )}
          {dish.allergens.length > 0 && (
            <p className="text-sm">
              <span className="text-muted">Аллергены: </span>
              {dish.allergens.join(", ").toLowerCase()}
            </p>
          )}
        </section>

        {hasRecipe && (
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
        )}

        {dish.history && (
          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-2xl font-semibold">История</h2>
            <Paragraphs text={dish.history} className="leading-relaxed" />
          </section>
        )}
      </div>

      {dish.tags.length > 0 && (
        <p className="text-sm text-muted">Теги: {dish.tags.map((t) => t.name).join(", ")}</p>
      )}
    </article>
  );
}
