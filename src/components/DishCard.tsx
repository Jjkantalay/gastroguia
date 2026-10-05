import Link from "next/link";
import { DIFFICULTY_LABELS, formatTime, type DishSummary } from "@/lib/dishes";

export function DietBadges({ dish }: { dish: Pick<DishSummary, "vegan" | "vegetarian" | "glutenFree" | "spicy"> }) {
  const badges = [
    dish.vegan ? "веган" : dish.vegetarian ? "вегетарианское" : null,
    dish.glutenFree ? "без глютена" : null,
    dish.spicy ? "острое" : null,
  ].filter(Boolean);
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span key={b} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
          {b}
        </span>
      ))}
    </div>
  );
}

export function DishCard({ dish }: { dish: DishSummary }) {
  const meta = [
    dish.cuisine,
    dish.course,
    formatTime(dish.cookingTimeMin),
    dish.difficulty ? DIFFICULTY_LABELS[dish.difficulty] : null,
    dish.calories ? `${dish.calories} ккал` : null,
  ].filter(Boolean);
  return (
    <Link
      href={`/dishes/${dish.slug}`}
      className="flex flex-col gap-2 overflow-hidden rounded-xl border border-line transition hover:border-accent"
    >
      {dish.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dish.imageUrl} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
      )}
      <div className="flex flex-col gap-2 p-4">
      <h3 className="font-serif text-lg font-semibold">{dish.name}</h3>
      <p className="text-xs text-muted">{meta.join(" · ")}</p>
      <p className="line-clamp-3 text-sm">{dish.description}</p>
      <DietBadges dish={dish} />
      </div>
    </Link>
  );
}
