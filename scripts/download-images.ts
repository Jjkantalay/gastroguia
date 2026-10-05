// Скачивает фото блюд и фирменную графику со старого сайта в public/, сохраняя пути /wp-content/uploads/...
// Так старые ссылки на картинки продолжают работать и после переезда домена.
// Запуск: npm run images:download  (источник можно сменить: LEGACY_IMAGE_ORIGIN=https://...)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ContentFile } from "../src/db/content";
import { SITE_ASSETS } from "../src/lib/assets";

const origin = process.env.LEGACY_IMAGE_ORIGIN ?? "https://gastroguia.ru";
const content: ContentFile = JSON.parse(readFileSync("content/dishes.json", "utf8"));
const paths = [
  ...new Set([
    ...content.dishes.map((d) => d.image).filter((p): p is string => !!p),
    ...Object.values(SITE_ASSETS).flat(),
  ]),
];

let downloaded = 0;
let failed = 0;
for (const path of paths) {
  const target = join("public", path);
  if (existsSync(target)) continue;
  const res = await fetch(origin + path);
  if (!res.ok) {
    console.error(`  ${res.status} ${path}`);
    failed++;
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  downloaded++;
}
console.log(`Файлы: скачано ${downloaded}, уже было ${paths.length - downloaded - failed}, ошибок ${failed}`);
if (failed) process.exit(1);
