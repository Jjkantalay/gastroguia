import type { NextConfig } from "next";
import main from "./content/dishes.json" with { type: "json" };
import extra from "./content/dishes-extra.json" with { type: "json" };

// Редиректы пустых карточек со старого сайта на каталог не нужны, если блюдо уже появилось
const added = new Set(extra.dishes.map((d) => d.slug));
const legacyRedirects = main.redirects.filter(
  (r) => !(r.destination === "/dishes" && added.has(r.source.replace("/bliuda/", ""))),
);

// Откуда брать фото, которые ещё не скачаны в public/ (npm run images:download).
// Нужно только на время переезда, пока старый сайт доступен по другому адресу.
const legacyImageOrigin = process.env.LEGACY_IMAGE_ORIGIN;

const nextConfig: NextConfig = {
  output: "standalone",
  // PGlite загружает свои wasm-файлы сам, бандлить его нельзя
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector"],
  async redirects() {
    return [
      // Старые адреса WordPress: переименованные карточки, затем все остальные
      ...legacyRedirects.map((r) => ({ ...r, permanent: true })),
      { source: "/bliuda/:slug", destination: "/dishes/:slug", permanent: true },
      { source: "/bliuda", destination: "/dishes", permanent: true },
      { source: "/kukhnia/:slug", destination: "/dishes?cuisine=:slug", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: legacyImageOrigin
        ? [{ source: "/wp-content/uploads/:path*", destination: `${legacyImageOrigin}/wp-content/uploads/:path*` }]
        : [],
    };
  },
};

export default nextConfig;
