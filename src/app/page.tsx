import Link from "next/link";
import { DishCard } from "@/components/DishCard";
import { listCuisines, searchDishes } from "@/lib/dishes";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [cuisines, featured] = await Promise.all([listCuisines(), searchDishes({ limit: 9 })]);
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4 py-6">
        <h1 className="font-serif text-4xl font-semibold sm:text-5xl">Путеводитель по блюдам Кавказа</h1>
        <p className="max-w-2xl text-muted">
          Истории, ингредиенты и традиции грузинской, армянской, азербайджанской и чеченской кухни. Ищите по названию,
          ингредиенту или спросите ассистента.
        </p>
        <form action="/dishes" className="flex max-w-xl gap-2">
          <input
            name="q"
            placeholder="Например, хинкали или блюда с тыквой"
            className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-4 py-2.5 outline-none focus:border-accent"
          />
          <button className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white">Найти</button>
        </form>
        <Link href="/assistant" className="text-sm text-accent hover:underline">
          Или спросите кулинарного ассистента →
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-semibold">Кухни</h2>
        <div className="flex flex-wrap gap-2">
          {cuisines.filter((c) => c.dishCount > 0).map((c) => (
            <Link
              key={c.slug}
              href={`/dishes?cuisine=${c.slug}`}
              className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent"
            >
              {c.name} <span className="text-muted">{c.dishCount}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-semibold">Блюда</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((d) => (
            <DishCard key={d.slug} dish={d} />
          ))}
        </div>
        <Link href="/dishes" className="text-sm text-accent hover:underline">Все блюда →</Link>
      </section>
    </div>
  );
}
