import Link from "next/link";
import type { DishSummary } from "@/lib/dishes";

// Карточка как в листинге JetEngine на старом сайте: высокое фото, название поверх снизу
export function DishCard({ dish, className = "" }: { dish: DishSummary; className?: string }) {
  return (
    <Link
      href={`/dishes/${dish.slug}`}
      className={`group relative block h-[360px] overflow-hidden rounded-[10px] bg-ink-soft sm:h-[500px] sm:rounded-[30px] ${className}`}
    >
      {dish.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dish.imageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover brightness-90 contrast-125 transition duration-500 group-hover:scale-105"
        />
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-6 pt-16 text-center">
        <span className="t-section block text-light">{dish.name}</span>
        {dish.cuisine && <span className="mt-2 block text-sm lowercase text-light/80">{dish.cuisine} кухня</span>}
      </span>
    </Link>
  );
}

export function SectionHeading({ title, hint, id }: { title: string; hint?: string; id?: string }) {
  return (
    <div id={id} className="mb-6 flex scroll-mt-6 flex-col gap-2 border-b-2 border-ink pb-3 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="t-section">{title}</h2>
      {hint && <p className="text-base sm:text-xl">{hint}</p>}
    </div>
  );
}

// Горизонтальная лента карточек: «листай влево и смотри все блюда»
export function DishRow({ dishes }: { dishes: DishSummary[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:gap-6 sm:px-8">
      {dishes.map((d) => (
        <DishCard key={d.slug} dish={d} className="w-[72%] shrink-0 snap-start sm:w-[calc((100%-3*1.5rem)/4)]" />
      ))}
    </div>
  );
}
