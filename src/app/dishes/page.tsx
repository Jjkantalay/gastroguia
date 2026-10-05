import type { Metadata } from "next";
import { DishCard, SectionHeading } from "@/components/DishCard";
import { COURSES } from "@/db/schema";
import { listCuisines, searchDishes } from "@/lib/dishes";
import { filtersFromSearchParams } from "@/lib/filters";

export const metadata: Metadata = { title: "Все блюда" };

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

  const field = "border-2 border-ink bg-transparent px-3 py-2.5 outline-none focus:bg-light";

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading title="Все блюда" hint={`найдено: ${items.length}`} />

      <form className="frame grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" defaultValue={params.get("q") ?? ""} placeholder="название или описание" className={`${field} sm:col-span-2`} />
        <select name="cuisine" defaultValue={params.get("cuisine") ?? ""} className={field}>
          <option value="">любая кухня</option>
          {cuisines
            .filter((c) => c.dishCount > 0)
            .map((c) => (
              <option key={c.slug} value={c.slug}>{c.name.toLowerCase()}</option>
            ))}
        </select>
        <select name="course" defaultValue={params.get("course") ?? ""} className={field}>
          <option value="">любой тип</option>
          {COURSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input name="with" defaultValue={params.get("with") ?? ""} placeholder="есть ингредиент: тыква" className={field} />
        <input name="without" defaultValue={params.get("without") ?? ""} placeholder="без ингредиента" className={field} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {[
            ["vegetarian", "вегетарианское"],
            ["glutenFree", "без глютена"],
          ].map(([name, label]) => (
            <label key={name} className="flex items-center gap-1.5">
              <input type="checkbox" name={name} value="true" defaultChecked={checked(name)} className="accent-ink" />
              {label}
            </label>
          ))}
        </div>
        <button className="bg-ink px-4 py-2.5 font-bold uppercase text-light hover:bg-moss">Показать</button>
      </form>

      {items.length === 0 ? (
        <p className="t-body">Ничего не нашлось — попробуйте убрать часть фильтров.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <DishCard key={d.slug} dish={d} />
          ))}
        </div>
      )}
    </div>
  );
}
