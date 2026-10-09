import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DishCard } from "@/components/DishCard";
import { SITE_ASSETS } from "@/lib/assets";
import { DIFFICULTY_LABELS, formatTime, getDish, searchDishes } from "@/lib/dishes";
import { cuisineLabel, label, language, languages, type Language } from "@/lib/i18n";
import { photoCredit, safeUrl } from "@/lib/photos";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ lang?: string | string[] }>;

const loadDish = cache(getDish);

type Dish = NonNullable<Awaited<ReturnType<typeof getDish>>>;

// Тексты блюда на выбранном языке: перевод, иначе английский, иначе русский оригинал
function localize(dish: Dish, lang: Language) {
  const base = {
    name: dish.name,
    description: dish.description,
    quote: dish.quote,
    history: dish.history,
    ingredientsText: dish.ingredientsText,
    allergens: dish.allergens,
    translated: lang.code === "ru",
    fallbackEn: false,
  };
  if (lang.code === "ru") return base;
  const own = dish.translations.find((t) => t.locale === lang.code);
  const tr = own ?? dish.translations.find((t) => t.locale === "en");
  if (!tr) return base;
  return {
    name: tr.name || dish.name,
    description: tr.description || dish.description,
    quote: tr.quote ?? null,
    history: tr.history ?? null,
    ingredientsText: tr.ingredientsText ?? null,
    allergens: tr.allergens,
    translated: true,
    fallbackEn: !own,
  };
}

const langOf = async (searchParams: SearchParams) => language([(await searchParams).lang].flat()[0]);

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const dish = await loadDish((await params).slug);
  if (!dish) return {};
  const lang = await langOf(searchParams);
  const text = localize(dish, lang);
  const cuisine = dish.cuisine ? cuisineLabel(lang, dish.cuisine.slug, `${dish.cuisine.name} кухня`) : null;
  return {
    title: cuisine ? `${text.name} — ${cuisine.toLowerCase()}` : text.name,
    description: text.description,
    alternates: {
      canonical: lang.code === "ru" ? `/dishes/${dish.slug}` : `/dishes/${dish.slug}?lang=${lang.code}`,
      languages: Object.fromEntries(
        languages().map((l) => [l.code, l.code === "ru" ? `/dishes/${dish.slug}` : `/dishes/${dish.slug}?lang=${l.code}`]),
      ),
    },
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

export default async function DishPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const dish = await loadDish((await params).slug);
  if (!dish) notFound();
  const lang = await langOf(searchParams);
  const text = localize(dish, lang);
  const cuisine = dish.cuisine ? cuisineLabel(lang, dish.cuisine.slug, `${dish.cuisine.name} кухня`) : null;

  const related = (await searchDishes({ cuisine: dish.cuisine?.slug, limit: 4 }))
    .filter((d) => d.slug !== dish.slug)
    .slice(0, 3);
  if (related.length < 3) {
    const more = await searchDishes({ limit: 10 });
    for (const d of more) if (related.length < 3 && d.slug !== dish.slug && !related.some((r) => r.slug === d.slug)) related.push(d);
  }

  const credit = photoCredit(dish.slug);
  // Шаги рецепта есть только по-русски
  const hasRecipe = dish.steps.length > 0 && lang.code === "ru";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": hasRecipe ? "Recipe" : "Article",
    name: text.name,
    headline: text.name,
    description: text.description,
    inLanguage: lang.code,
    image: dish.imageUrl ?? undefined,
    ...(hasRecipe
      ? {
          recipeCuisine: cuisine ?? undefined,
          recipeCategory: dish.course ?? undefined,
          totalTime: dish.cookingTimeMin ? `PT${dish.cookingTimeMin}M` : undefined,
          recipeIngredient: dish.ingredients.map((i) => [i.name, i.amount].filter(Boolean).join(" — ")),
          recipeInstructions: dish.steps.map((text) => ({ "@type": "HowToStep", text })),
        }
      : {}),
  };

  // Время, сложность и прочее подписаны только по-русски — на других языках не показываем
  const facts = (lang.code !== "ru" ? [] : [
    ["Время", formatTime(dish.cookingTimeMin)],
    ["Сложность", dish.difficulty ? DIFFICULTY_LABELS[dish.difficulty] : null],
    ["Порций", dish.servings],
    ["Калории", dish.calories ? `${dish.calories} ккал` : null],
  ]).filter(([, v]) => v != null);
  // Список ингредиентов с количествами хранится по-русски; на других языках — переведённый текст
  const showIngredientList = dish.ingredients.length > 0 && (lang.code === "ru" || !text.ingredientsText);

  return (
    <article lang={lang.code} dir={lang.dir} className="flex flex-col gap-12 sm:gap-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="flex flex-col gap-8 md:flex-row md:justify-between">
        <div className="flex flex-col gap-2 md:w-1/2">
          {dish.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dish.imageUrl} alt={text.name} className="aspect-[4/3] w-full rounded-[25px] object-cover md:aspect-auto md:h-full md:max-h-[80vh]" />
          ) : (
            <div className="aspect-[4/3] w-full rounded-[25px] bg-ink-soft" />
          )}
          {credit && (
            <p className="text-xs opacity-75">
              {label(lang, "photo")}:{" "}
              <a href={safeUrl(credit.source)} target="_blank" rel="noopener noreferrer" className="underline">
                {credit.author}
              </a>{" "}
              ·{" "}
              <a href={safeUrl(credit.licenseUrl)} target="_blank" rel="noopener noreferrer" className="underline">
                {credit.license}
              </a>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-6 md:w-[46%]">
          <p className="text-sm">
            <Link href="/dishes" className="hover:text-accent">// {label(lang, "crumb_dishes")}</Link>
            {dish.cuisine && cuisine && (
              <>
                {" / "}
                <Link href={`/#${dish.cuisine.slug}`} className="hover:text-accent">{cuisine.toLowerCase()}</Link>
              </>
            )}
          </p>
          <nav aria-label={label(lang, "language")} className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {languages().map((l) =>
              l.code === lang.code ? (
                <span key={l.code} lang={l.code} className="font-semibold underline">{l.name}</span>
              ) : (
                <Link
                  key={l.code}
                  lang={l.code}
                  hrefLang={l.code}
                  href={l.code === "ru" ? `/dishes/${dish.slug}` : `/dishes/${dish.slug}?lang=${l.code}`}
                  className="opacity-75 hover:text-accent hover:opacity-100"
                >
                  {l.name}
                </Link>
              ),
            )}
          </nav>
          <h1 className="t-title">{text.name}</h1>
          {cuisine && <p className="t-label rule pb-2">{cuisine}</p>}
          {text.fallbackEn && <p className="text-sm italic">{label(lang, "in_english")}</p>}
          <p className="t-body">{text.description}</p>

          {text.quote && (
            <figure className="flex items-start justify-between gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SITE_ASSETS.quote} alt="" className="w-[10%] min-w-8" />
              <blockquote className="w-[85%] text-lg italic sm:text-2xl">{text.quote}</blockquote>
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

      <Section title={label(lang, "ingredients")}>
        {showIngredientList ? (
          <ul className="flex flex-wrap gap-x-6 gap-y-4">
            {dish.ingredients.map((i) => (
              <li key={i.name} className="flex">
                <span className="t-body border border-ink-soft px-2.5 py-1">{i.name}</span>
                {i.amount && <span className="t-body self-center border-l border-dotted border-ink px-3">{i.amount}</span>}
              </li>
            ))}
          </ul>
        ) : text.ingredientsText ? (
          <p className="t-body whitespace-pre-line md:columns-2 md:gap-12">{text.ingredientsText}</p>
        ) : (
          <p className="t-body">{label(lang, "not_specified")}</p>
        )}
      </Section>

      {text.allergens.length > 0 && (
        <Section title={label(lang, "allergens")}>
          <ul className="flex flex-wrap gap-3">
            {text.allergens.map((a) => (
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

      {text.history && (
        <Section title={label(lang, "history")}>
          <div className="t-body flex flex-col gap-4 md:block md:columns-2 md:gap-[6%]">
            {text.history.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="whitespace-pre-line md:mb-4 md:break-inside-avoid-column">{p}</p>
            ))}
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section title={label(lang, "also")}>
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
