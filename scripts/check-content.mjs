// Проверка наполнения сайта на C: каждое блюдо на каждом языке, главная, каталог, API и редиректы.
// Запуск при работающем сервере: node scripts/check-content.mjs [http://localhost:8080]

import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:8080";
const i18n = JSON.parse(readFileSync("content/i18n.json", "utf8")).languages;
const main = JSON.parse(readFileSync("content/dishes.json", "utf8"));
const extra = JSON.parse(readFileSync("content/dishes-extra.json", "utf8"));
const dishes = [...main.dishes, ...extra.dishes];

const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);
const textOf = (html, re) => (html.match(re)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();

async function get(path, { redirect = "follow" } = {}) {
  const res = await fetch(base + path, { redirect });
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
}

let pages = 0;
for (const lang of i18n) {
  const q = lang.code === "ru" ? "" : `?lang=${lang.code}`;

  const home = await get(`/${q}`);
  pages++;
  if (home.status !== 200) fail(`/${q}`, `статус ${home.status}`);
  if (!home.html.includes(`<html lang="${lang.code}" dir="${lang.dir}"`)) fail(`/${q}`, "неверный lang/dir");
  if (home.html.includes("(null)")) fail(`/${q}`, "(null) в разметке");

  const cat = await get(`/dishes${q}`);
  pages++;
  const cards = (cat.html.match(/class="card[ "]/g) ?? []).length;
  if (cards !== dishes.length) fail(`/dishes${q}`, `карточек ${cards} из ${dishes.length}`);

  for (const d of dishes) {
    const path = `/dishes/${d.slug}${q}`;
    const { status, html } = await get(path);
    pages++;
    if (status !== 200) { fail(path, `статус ${status}`); continue; }
    if (html.includes("(null)")) fail(path, "(null) в разметке");
    const h1 = textOf(html, /<h1 class="t-title"[^>]*>([\s\S]*?)<\/h1>/);
    if (!h1) fail(path, "нет названия");
    const expected = lang.code === "ru" ? d.name : lang.code === "en" ? d.translations?.en?.name : extra.names[d.slug]?.[lang.code];
    if (expected && h1 !== expected.replace(/&/g, "&amp;")) fail(path, `название «${h1}», ожидалось «${expected}»`);
    if (!textOf(html, /<p class="t-body"[^>]*>([\s\S]*?)<\/p>/)) fail(path, "нет описания");
    if (!textOf(html, /<p class="t-body ingredients"[^>]*>([\s\S]*?)<\/p>/)) fail(path, "нет ингредиентов");
    if (!html.includes('class="t-body columns"')) fail(path, "нет исторической справки");
    if (!html.includes("dish-section")) fail(path, "нет разделов");
  }
}

const api = JSON.parse((await get("/api/dishes")).html);
if (api.items.length !== dishes.length) fail("/api/dishes", `блюд ${api.items.length} из ${dishes.length}`);

for (const slug of ["kubdari", "shashlyk", "adzhapsandali", "lobio-2", "plov"]) {
  const r = await get(`/bliuda/${slug}/`, { redirect: "manual" });
  if (r.status !== 301 || !r.location?.startsWith("/dishes")) fail(`/bliuda/${slug}/`, `редирект ${r.status} ${r.location}`);
}

console.log(`Проверено страниц: ${pages}, языков: ${i18n.length}, блюд: ${dishes.length}`);
if (problems.length) {
  console.log(`Проблем: ${problems.length}`);
  for (const p of problems.slice(0, 50)) console.log("  " + p);
  process.exit(1);
}
console.log("Наполнение в порядке: у каждого блюда на каждом языке есть название, описание, ингредиенты и история.");
