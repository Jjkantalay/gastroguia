import Link from "next/link";
import { CuisineMarquee } from "@/components/CuisineMarquee";
import { DishRow, SectionHeading } from "@/components/DishCard";
import { listCuisines, searchDishes } from "@/lib/dishes";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [cuisines, dishes] = await Promise.all([listCuisines(), searchDishes({ limit: 500 })]);
  const withDishes = cuisines
    .filter((c) => c.dishCount > 0)
    .sort((a, b) => b.dishCount - a.dishCount)
    .map((c) => ({ ...c, dishes: dishes.filter((d) => d.cuisineSlug === c.slug) }));

  return (
    <div className="flex flex-col gap-14 sm:gap-20">
      <section className="flex flex-col gap-6">
        <h1 className="sr-only">Гастрогид — твой виртуальный гид в мире кавказской кухни</h1>
        <CuisineMarquee
          slides={withDishes.map((c) => ({ slug: c.slug, name: c.name, image: c.dishes.find((d) => d.imageUrl)?.imageUrl ?? null }))}
        />
      </section>

      <section className="frame grid md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2 border-b-4 border-ink p-6 md:border-b-0 md:border-r-4">
          <p className="t-section">Спроси гида</p>
          <p className="text-base sm:text-xl">что попробовать, из чего готовят и откуда пришло блюдо</p>
        </div>
        <Link
          href="/assistant"
          className="flex items-center justify-center bg-moss px-8 py-6 font-serif text-3xl text-paper hover:bg-ink sm:text-5xl"
        >
          Задать вопрос
        </Link>
      </section>

      {withDishes.map((c) => (
        <section key={c.slug}>
          <SectionHeading id={c.slug} title={`${c.name} кухня`} hint="листай влево и смотри все блюда" />
          <DishRow dishes={c.dishes} />
        </section>
      ))}

      <section>
        <SectionHeading title="Все блюда" hint="листай влево и смотри все блюда" />
        <DishRow dishes={dishes} />
        <Link href="/dishes" className="frame mt-4 inline-block px-6 py-3 font-bold uppercase hover:bg-ink hover:text-light">
          Поиск и фильтры →
        </Link>
      </section>
    </div>
  );
}
