import type { Metadata } from "next";
import { DishCard } from "@/components/DishCard";
import { COURSES } from "@/db/schema";
import { listCuisines, searchDishes } from "@/lib/dishes";
import { filtersFromSearchParams } from "@/lib/filters";

export const metadata: Metadata = { title: "Блюда" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toURLSearchParams(sp: Awaited<SearchParams>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const item of [v].flat()) if (item) p.append(k, item);
  return p;
}

export default async function DishesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = toURLSearchParams(await searchParams);
  const filtersResult = (() => {
    try {
      return filtersFromSearchParams(params);
    } catch {
      return {};
    }
  })();
  const [items, cuisines] = await Promise.all([searchDishes({ ...filtersResult, limit: 50 }), listCuisines()]);
  const checked = (k: string) => params.get(k) === "true";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl font-semibold">Блюда</h1>

      <form className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Название или описание"
          className="rounded-lg border border-line bg-transparent px-3 py-2 sm:col-span-2"
        />
        <select name="cuisine" defaultValue={params.get("cuisine") ?? ""} className="rounded-lg border border-line bg-transparent px-3 py-2">
          <option value="">Любая кухня</option>
          {cuisines.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select name="course" defaultValue={params.get("course") ?? ""} className="rounded-lg border border-line bg-transparent px-3 py-2">
          <option value="">Любой тип</option>
          {COURSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          name="with"
          defaultValue={params.get("with") ?? ""}
          placeholder="Есть ингредиент, например нут"
          className="rounded-lg border border-line bg-transparent px-3 py-2"
        />
        <input
          name="without"
          defaultValue={params.get("without") ?? ""}
          placeholder="Без ингредиента"
          className="rounded-lg border border-line bg-transparent px-3 py-2"
        />
        <select name="maxTimeMin" defaultValue={params.get("maxTimeMin") ?? ""} className="rounded-lg border border-line bg-transparent px-3 py-2">
          <option value="">Любое время</option>
          <option value="30">до 30 мин</option>
          <option value="60">до 1 часа</option>
          <option value="120">до 2 часов</option>
        </select>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {[
            ["vegetarian", "вегетарианское"],
            ["vegan", "веган"],
            ["glutenFree", "без глютена"],
          ].map(([name, label]) => (
            <label key={name} className="flex items-center gap-1.5">
              <input type="checkbox" name={name} value="true" defaultChecked={checked(name)} />
              {label}
            </label>
          ))}
        </div>
        <button className="rounded-lg bg-accent px-4 py-2 font-medium text-white lg:col-start-4">Показать</button>
      </form>

      <p className="text-sm text-muted">Найдено: {items.length}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => (
          <DishCard key={d.slug} dish={d} />
        ))}
      </div>
    </div>
  );
}
