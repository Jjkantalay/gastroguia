import { dishFiltersSchema, type DishFilters } from "./dishes";

type Params = { get(name: string): string | null; getAll(name: string): string[] };

const bool = (v: string | null) => (v === "true" || v === "1" ? true : v === "false" || v === "0" ? false : undefined);
const int = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

// Разбор фильтров из строки запроса — для страницы каталога и REST API
export function filtersFromSearchParams(p: Params): DishFilters {
  return dishFiltersSchema.parse({
    q: p.get("q") || undefined,
    cuisine: p.get("cuisine") || undefined,
    course: p.get("course") || undefined,
    vegetarian: bool(p.get("vegetarian")),
    vegan: bool(p.get("vegan")),
    glutenFree: bool(p.get("glutenFree")),
    spicy: bool(p.get("spicy")),
    maxTimeMin: int(p.get("maxTimeMin")),
    maxCalories: int(p.get("maxCalories")),
    withIngredients: p.getAll("with").filter(Boolean),
    withoutIngredients: p.getAll("without").filter(Boolean),
    limit: int(p.get("limit")),
    offset: int(p.get("offset")),
  });
}
