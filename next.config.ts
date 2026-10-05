import type { NextConfig } from "next";
import content from "./content/dishes.json" with { type: "json" };

// Откуда брать фото, которые ещё не скачаны в public/ (npm run images:download).
// Нужно только на время переезда, пока старый сайт доступен по другому адресу.
const legacyImageOrigin = process.env.LEGACY_IMAGE_ORIGIN;

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // Старые адреса WordPress: переименованные карточки, затем все остальные
      ...content.redirects.map((r) => ({ ...r, permanent: true })),
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
