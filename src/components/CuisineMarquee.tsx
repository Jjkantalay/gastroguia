import { CUISINE_COVERS } from "@/lib/assets";

type Slide = { slug: string; name: string; image: string | null };

// Бегущая лента кухонь со старой главной: приглушённые фото, при наведении — цвет и подпись
export function CuisineMarquee({ slides }: { slides: Slide[] }) {
  if (!slides.length) return null;
  // Дублируем ленту, чтобы прокрутка была бесшовной
  const items = [...slides, ...slides, ...slides, ...slides];
  return (
    <div className="-mx-4 overflow-hidden sm:-mx-8">
      <div className="marquee flex w-max gap-4">
        {[items, items].map((group, g) => (
          <div key={g} className="flex gap-4" aria-hidden={g === 1}>
            {group.map((s, i) => {
              const image = CUISINE_COVERS[s.slug] ?? s.image;
              return (
                <a
                  key={`${s.slug}-${i}`}
                  href={`#${s.slug}`}
                  tabIndex={g === 1 ? -1 : undefined}
                  className="group relative block h-[300px] w-[60vw] shrink-0 overflow-hidden transition-[width] duration-500 sm:h-[450px] sm:w-[20vw] sm:hover:w-[36vw]"
                >
                  {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="h-full w-full object-cover saturate-[.3] transition duration-500 group-hover:saturate-100" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 p-5 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="t-section block">{s.name} кухня</span>
                    <span className="mt-1 block text-sm lowercase sm:text-lg">жми и смотри все блюда</span>
                  </span>
                </a>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
