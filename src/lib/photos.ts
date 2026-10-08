import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PhotosFile } from "@/db/content";

// Автор и лицензия фото со свободной лицензией (content/photos.json); файл может отсутствовать
let cache: PhotosFile | null = null;
export function photoCredit(slug: string) {
  if (!cache) {
    const path = join(process.cwd(), "content", "photos.json");
    cache = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  }
  return cache![slug] ?? null;
}

export const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//.test(u) ? u : undefined);
