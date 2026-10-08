// Подбирает фото блюд со свободной лицензией на Wikimedia Commons и записывает авторов в content/photos.json.
//
// 1. Ищет блюдо в Wikidata по английскому названию; берёт основное фото (свойство P18),
//    если описание элемента похоже на блюдо или продукт.
// 2. Если не нашлось — ищет файл на Commons. Такие фото помечаются review: true, их стоит просмотреть.
// Берутся только CC0, общественное достояние, CC BY и CC BY-SA. Файлы сохраняются в public/images/dishes/.
//
// Запуск: node scripts/fetch-photos.mjs [--limit 50] [--only slug,slug] [--dry-run]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const WIKIDATA = process.env.WIKIDATA_API ?? "https://www.wikidata.org/w/api.php";
const COMMONS = process.env.COMMONS_API ?? "https://commons.wikimedia.org/w/api.php";
// Wikimedia требует понятный User-Agent с контактом
const UA = "GastroguiaPhotoFetcher/1.0 (https://gastroguia.ru; Jorjanoo@yandex.ru)";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const limit = Number(opt("--limit") ?? Infinity);
const only = opt("--only")?.split(",");
const dryRun = args.includes("--dry-run");

const main = JSON.parse(readFileSync("content/dishes.json", "utf8"));
const extra = JSON.parse(readFileSync("content/dishes-extra.json", "utf8"));
const photosPath = "content/photos.json";
const photos = existsSync(photosPath) ? JSON.parse(readFileSync(photosPath, "utf8")) : {};

const FOOD = /\b(dish|food|cuisine|bread|flatbread|soup|stew|pastry|pie|cheese|drink|beverage|sauce|condiment|dessert|sweet|confection|kebab|kabob|salad|dumpling|sausage|porridge|pudding|cake|candy|yogurt|yoghurt|tea|coffee|noodle|pilaf|rice|meal|snack|appetizer|starter|paste|jam|preserve|halva|nougat|cookie|biscuit|meatball|omelette|casserole)\b/i;
const FREE = /^(cc0|public domain|pd\b|pd-|cc[ -]by(-sa)?([ -][0-9.]+)?)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    throw new Error(`${res.status} ${url}`);
  }
  throw new Error(`не отвечает ${url}`);
}

const stripHtml = (s) => (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function fromWikidata(name) {
  const found = await api(WIKIDATA, { action: "wbsearchentities", search: name, language: "en", type: "item", limit: "5" });
  const ids = (found.search ?? []).map((s) => s.id);
  if (!ids.length) return null;
  const ent = await api(WIKIDATA, { action: "wbgetentities", ids: ids.join("|"), props: "claims|descriptions", languages: "en" });
  for (const id of ids) {
    const e = ent.entities?.[id];
    const desc = e?.descriptions?.en?.value ?? "";
    const file = e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (file && FOOD.test(desc)) return { file, how: `wikidata:${id}` };
  }
  return null;
}

async function fromCommonsSearch(name) {
  const res = await api(COMMONS, { action: "query", list: "search", srsearch: `${name} filetype:bitmap`, srnamespace: "6", srlimit: "5" });
  const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const hit = (res.query?.search ?? []).find((r) => words.some((w) => r.title.toLowerCase().includes(w)));
  return hit ? { file: hit.title.replace(/^File:/, ""), how: "commons-search", review: true } : null;
}

async function imageInfo(file) {
  const res = await api(COMMONS, { action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|extmetadata|mime", iiurlwidth: "1200" });
  const page = Object.values(res.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (!FREE.test(license)) return { rejected: license || "лицензия не указана" };
  if (!/^image\/(jpeg|png|webp)$/.test(info.mime)) return { rejected: `формат ${info.mime}` };
  return {
    url: info.thumburl ?? info.url,
    ext: info.mime === "image/png" ? "png" : info.mime === "image/webp" ? "webp" : "jpg",
    author: stripHtml(meta.Artist?.value) || stripHtml(meta.Credit?.value) || "Wikimedia Commons",
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
    source: info.descriptionurl,
  };
}

const englishName = new Map([
  ...main.dishes.map((d) => [d.slug, d.translations?.en?.name ?? d.name]),
  ...extra.dishes.map((d) => [d.slug, d.translations.en.name]),
]);
const withImage = new Set(main.dishes.filter((d) => d.image).map((d) => d.slug));
const todo = [...englishName.keys()].filter((s) => !withImage.has(s) && !photos[s] && (!only || only.includes(s))).slice(0, limit);

mkdirSync("public/images/dishes", { recursive: true });
let ok = 0;
const missed = [];
for (const slug of todo) {
  const name = englishName.get(slug).replace(/\s*\(.*\)$/, "");
  try {
    const pick = (await fromWikidata(name)) ?? (await fromCommonsSearch(name));
    if (!pick) { missed.push(`${slug}: не найдено`); continue; }
    const info = await imageInfo(pick.file);
    if (!info || info.rejected) { missed.push(`${slug}: ${pick.file} — ${info?.rejected ?? "нет данных"}`); continue; }
    const image = `/images/dishes/${slug}.${info.ext}`;
    if (!dryRun) {
      const res = await fetch(info.url, { headers: { "User-Agent": UA } });
      if (!res.ok) { missed.push(`${slug}: скачивание ${res.status}`); continue; }
      writeFileSync(`public${image}`, Buffer.from(await res.arrayBuffer()));
      photos[slug] = { image, author: info.author, license: info.license, licenseUrl: info.licenseUrl, source: info.source, found: pick.how, ...(pick.review ? { review: true } : {}) };
      writeFileSync(photosPath, JSON.stringify(photos, null, 1) + "\n");
    }
    ok++;
    console.log(`  ${slug}: ${pick.file} (${info.license}${pick.review ? ", проверить" : ""})`);
  } catch (e) {
    missed.push(`${slug}: ${e.message}`);
  }
  await sleep(300); // бережём API Wikimedia
}

console.log(`\nФото найдено: ${ok} из ${todo.length}. Всего в photos.json: ${Object.keys(photos).length}`);
if (missed.length) console.log(`Не найдено (${missed.length}):\n  ` + missed.join("\n  "));
const review = Object.entries(photos).filter(([, p]) => p.review).map(([s]) => s);
if (review.length) console.log(`\nНайдены поиском по Commons, стоит проверить глазами: ${review.join(", ")}`);
