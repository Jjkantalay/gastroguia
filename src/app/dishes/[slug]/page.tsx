import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DishCard } from "@/components/DishCard";
import { SITE_ASSETS } from "@/lib/assets";
import { DIFFICULTY_LABELS, formatTime, getDish, searchDishes } from "@/lib/dishes";

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

// Заголовок раздела как на старом сайте: капс и тонкая серая линия снизу
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="t-label rule pb-2">{title}</h2>
      {children}
    </section>
  );
}

export default async function DishPage({ params }: { params: Params }) {
  const dish = await loadDish((await params).slug);
  if (!dish) notFound();

  const related = (await searchDishes({ cuisine: dish.cuisine?.slug, limit: 4 }))
    .filter((d) => d.slug !== dish.slug)
    .slice(0, 3);
  if (related.length < 3) {
    const more = await searchDishes({ limit: 10 });
    for (const d of more) if (related.length < 3 && d.slug !== dish.slug && !related.some((r) => r.slug === d.slug)) related.push(d);
  }

  const hasRecipe = dish.steps.length > 0;
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
          totalTime: dish.cookingTimeMin ? `PT${dish.cookingTimeMin}M` : undefined,
          recipeIngredient: dish.ingredients.map((i) => [i.name, i.amount].filter(Boolean).join(" — ")),
          recipeInstructions: dish.steps.map((text) => ({ "@type": "HowToStep", text })),
        }
      : {}),
  };

  const facts = [
    ["Время", formatTime(dish.cookingTimeMin)],
    ["Сложность", dish.difficulty ? DIFFICULTY_LABELS[dish.difficulty] : null],
    ["Порций", dish.servings],
    ["Калории", dish.calories ? `${dish.calories} ккал` : null],
  ].filter(([, v]) => v != null);

  return (
    <article className="flex flex-col gap-12 sm:gap-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="flex flex-col gap-8 md:flex-row md:justify-between">
        <div className="md:w-1/2">
          {dish.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dish.imageUrl} alt={dish.name} className="aspect-[4/3] w-full rounded-[25px] object-cover md:aspect-auto md:h-full md:max-h-[80vh]" />
          ) : (
            <div className="aspect-[4/3] w-full rounded-[25px] bg-ink-soft" />
          )}
        </div>

        <div className="flex flex-col gap-6 md:w-[46%]">
          <p className="text-sm">
            <Link href="/dishes" className="hover:text-accent">// блюда</Link>
            {dish.cuisine && (
              <>
                {" / "}
                <Link href={`/#${dish.cuisine.slug}`} className="hover:text-accent">{dish.cuisine.name.toLowerCase()} кухня</Link>
              </>
            )}
          </p>
          <h1 className="t-title">{dish.name}</h1>
          {dish.cuisine && <p className="t-label rule pb-2">{dish.cuisine.name} кухня</p>}
          <p className="t-body">{dish.description}</p>

          {dish.quote && (
            <figure className="flex items-start justify-between gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SITE_ASSETS.quote} alt="" className="w-[10%] min-w-8" />
              <blockquote className="w-[85%] text-lg italic sm:text-2xl">{dish.quote}</blockquote>
            </figure>
          )}

          {facts.length > 0 && (
            <dl className="flex flex-wrap gap-3">
              {facts.map(([label, value]) => (
                <div key={label as string} className="border border-ink-soft px-3 py-1.5">
                  <dt className="inline text-sm">{label}: </dt>
                  <dd className="inline font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <Section title="Ингредиенты">
        {dish.ingredients.length > 0 ? (
          <ul className="flex flex-wrap gap-x-6 gap-y-4">
            {dish.ingredients.map((i) => (
              <li key={i.name} className="flex">
                <span className="t-body border border-ink-soft px-2.5 py-1">{i.name}</span>
                {i.amount && <span className="t-body self-center border-l border-dotted border-ink px-3">{i.amount}</span>}
              </li>
            ))}
          </ul>
        ) : dish.ingredientsText ? (
          <p className="t-body whitespace-pre-line md:columns-2 md:gap-12">{dish.ingredientsText}</p>
        ) : (
          <p className="t-body">Пока не указаны.</p>
        )}
      </Section>

      {dish.allergens.length > 0 && (
        <Section title="Аллергены">
          <ul className="flex flex-wrap gap-3">
            {dish.allergens.map((a) => (
              <li key={a} className="rounded-[clamp(6px,0.52vw,12px)] border border-ink px-3 pb-1.5 pt-1 text-base sm:text-xl">
                {a}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {hasRecipe && (
        <Section title="Приготовление">
          <ol className="t-body flex flex-col gap-4">
            {dish.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-bold">// {String(i + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {dish.history && (
        <Section title="Историческая справка">
          <div className="t-body flex flex-col gap-4 md:block md:columns-2 md:gap-[6%]">
            {dish.history.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="whitespace-pre-line md:mb-4 md:break-inside-avoid-column">{p}</p>
            ))}
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section title="Вам также может понравиться">
          <div className="grid gap-6 sm:grid-cols-3 sm:gap-[62px]">
            {related.map((d) => (
              <DishCard key={d.slug} dish={d} />
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}
