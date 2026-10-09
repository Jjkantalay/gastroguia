// Переносит блюда из экспорта WordPress (Инструменты → Экспорт) в content/dishes.json.
// Запуск: npm run import:wordpress -- путь/к/экспорту.xml
//
// Берём только записи типа «bliuda» (JetEngine). Языковые версии WPML
// (?lang=en, ?lang=es) становятся переводами русской записи с тем же слагом.
// Пустые карточки и всё остальное (записи блога, страницы Elementor) пропускаем.

import { readFileSync, writeFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { COURSES, type Course } from "../src/db/schema";
import type { ContentFile, ContentDish, ContentTranslation } from "../src/db/content";

const file = process.argv[2];
if (!file) {
  console.error("Укажите путь к XML: npm run import:wordpress -- export.xml");
  process.exit(1);
}

// Тип блюда в WordPress не хранился, проставляем вручную
const COURSE_BY_SLUG: Record<string, Course> = {
  hachapuri: "выпечка",
  hinkali: "основное",
  chahohbili: "основное",
  lobio: "основное",
  saczivi: "основное",
  "dolma-armyanskaya": "основное",
  hash: "суп",
  lahmadzho: "выпечка",
  gata: "выпечка",
  "horovacz-narsharab": "основное",
  plov: "основное",
  kutaby: "выпечка",
  "dolma-azerbajdzhanskaya": "основное",
  "shah-plov": "основное",
  pahlava: "десерт",
  hingalsh: "выпечка",
};

// Слаги вида lobio-2 появились из-за дублей в WordPress; старые адреса уйдут в редиректы
const SLUG_RENAMES: Record<string, string> = {
  "lobio-2": "lobio",
  "saczivi-2": "saczivi",
  "pahlava-2": "pahlava",
  dolma: "dolma-armyanskaya",
  "dolma-2": "dolma-azerbajdzhanskaya",
};

// Термины кухонь, которые в WordPress задублировались
const CUISINE_ALIASES: Record<string, string> = { "chechenskaya-chechenskaya": "chechenskaya" };

// Записи блога, которые дублируют карточку блюда
const LEGACY_POST_REDIRECTS: Record<string, string> = { hingalsh: "hingalsh", khingalash: "hingalsh" };

type Item = Record<string, unknown>;
type Meta = Record<string, string>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  cdataPropName: false,
  parseTagValue: false,
  isArray: (name) => ["item", "wp:postmeta", "category", "wp:term"].includes(name),
});
const xml = parser.parse(readFileSync(file, "utf8"));
const channel = xml.rss.channel;
const items: Item[] = channel.item;

const str = (v: unknown) => (v == null ? "" : String(v));

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…", lt: "<", gt: ">",
};

function cleanText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// «Для теста: … Для начинки: …» — каждый раздел с новой строки
const splitSections = (s: string) => s.replace(/\s+((?:Для|For|Para) [^:\n]{1,30}:)/g, "\n$1").trim();

// Цитаты на сайте были набраны в прямых кавычках — кавычки добавит шаблон
const stripQuotes = (s: string) => {
  if (!s.startsWith('"')) return s;
  const inner = s.slice(1);
  // Закрывающая кавычка бывает и перед точкой: "…alegría".
  return inner.endsWith('".') ? inner.slice(0, -2) + "." : inner.endsWith('"') ? inner.slice(0, -1) : inner;
};

function cleanAllergen(s: string): string | null {
  const t = cleanText(s);
  if (!t || t === "-") return null;
  // В одном блюде «Сахар» набран с латинской C
  const fixed = /^C[а-яё]/.test(t) ? "С" + t.slice(1) : t;
  return fixed[0].toUpperCase() + fixed.slice(1);
}

function metaOf(item: Item): Meta {
  const out: Meta = {};
  for (const m of (item["wp:postmeta"] as Item[] | undefined) ?? []) out[str(m["wp:meta_key"])] = str(m["wp:meta_value"]);
  return out;
}

function detectLocale(text: string): "ru" | "en" | "es" | null {
  if (!text.trim()) return null;
  const cyr = (text.match(/[а-яё]/gi) ?? []).length;
  const lat = (text.match(/[a-z]/gi) ?? []).length;
  if (cyr > lat) return "ru";
  return /[ñáéíóú¿¡]|\b(el|la|los|las|del|es)\b/i.test(text) ? "es" : "en";
}

// Вложения: id → путь вида /wp-content/uploads/2025/04/plov-.jpg
const attachments = new Map<string, string>();
for (const it of items) {
  if (str(it["wp:post_type"]) !== "attachment") continue;
  const url = str(it["wp:attachment_url"]);
  if (url) attachments.set(str(it["wp:post_id"]), new URL(url).pathname);
}

const cuisineNames = new Map<string, string>();
for (const t of (channel["wp:term"] as Item[] | undefined) ?? []) {
  if (str(t["wp:term_taxonomy"]) !== "kukhnia") continue;
  const slug = str(t["wp:term_slug"]);
  if (!CUISINE_ALIASES[slug]) cuisineNames.set(slug, str(t["wp:term_name"]));
}

type Version = {
  wpId: number;
  wpSlug: string;
  locale: "ru" | "en" | "es";
  cuisine: string | null;
  meta: Meta;
};

const groups = new Map<string, Version[]>();
const skipped: ContentFile["skipped"] = [];

for (const it of items) {
  if (str(it["wp:post_type"]) !== "bliuda" || str(it["wp:status"]) !== "publish") continue;
  const meta = metaOf(it);
  const wpId = Number(str(it["wp:post_id"]));
  const wpSlug = decodeURIComponent(str(it["wp:post_name"]));
  const title = str(it.title);
  const locale = detectLocale(meta.opisanie + " " + meta.istoriialevo);
  if (!locale || !cleanText(meta.opisanie)) {
    skipped.push({ wpId, slug: wpSlug, title, reason: "пустая карточка: нет описания" });
    continue;
  }
  const term = ((it.category as Item[] | undefined) ?? []).find((c) => c["@domain"] === "kukhnia");
  const termSlug = term ? str(term["@nicename"]) : null;
  const cuisine = termSlug ? (CUISINE_ALIASES[termSlug] ?? termSlug) : null;
  const list = groups.get(wpSlug) ?? [];
  list.push({ wpId, wpSlug, locale, cuisine, meta });
  groups.set(wpSlug, list);
}

function textFields(m: Meta): Omit<ContentTranslation, "name"> & { name?: string } {
  const history = [m.istoriialevo, m.istoriiapravo].map(cleanText).filter(Boolean).join("\n\n");
  return {
    description: cleanText(m.opisanie),
    quote: stripQuotes(cleanText(m.tsitata)) || null,
    history: history || null,
    ingredientsText: splitSections(cleanText(m["ingredienty-1"]) || cleanText(m["ingredienty-2"])) || null,
    allergens: [m.allergen1, m.allergen2, m.allergen3].map((a) => cleanAllergen(a ?? "")).filter((a): a is string => !!a),
  };
}

const dishes: ContentDish[] = [];
for (const [wpSlug, versions] of groups) {
  // Если у слага несколько русских версий, берём самую раннюю (оригинал)
  versions.sort((a, b) => a.wpId - b.wpId);
  const ru = versions.find((v) => v.locale === "ru");
  if (!ru) {
    for (const v of versions) skipped.push({ wpId: v.wpId, slug: wpSlug, title: v.meta.nazvanie, reason: "перевод без русской версии" });
    continue;
  }
  const slug = SLUG_RENAMES[wpSlug] ?? wpSlug;
  const course = COURSE_BY_SLUG[slug] ?? null;
  if (course && !COURSES.includes(course)) throw new Error(`Неизвестный тип блюда ${course}`);

  const translations: ContentDish["translations"] = {};
  for (const v of versions) {
    if (v.locale === "ru" || translations[v.locale]) continue;
    translations[v.locale] = { name: cleanText(v.meta.nazvanie) || cleanText(ru.meta.nazvanie), ...textFields(v.meta) };
  }

  dishes.push({
    slug,
    legacySlugs: slug === wpSlug ? [] : [wpSlug],
    wpIds: versions.map((v) => v.wpId),
    name: cleanText(ru.meta.nazvanie) || wpSlug,
    cuisine: ru.cuisine,
    course,
    ...textFields(ru.meta),
    // Таблица «ингредиент — количество» в WordPress заполнена у одного блюда и только частично
    // (у пахлавы — лишь тесто), поэтому источник — текстовое поле
    ingredients: [],
    image: attachments.get(ru.meta.foto) ?? null,
    translations,
  });
}
dishes.sort((a, b) => a.name.localeCompare(b.name, "ru"));

const redirects: ContentFile["redirects"] = [
  ...dishes.flatMap((d) => d.legacySlugs.map((s) => ({ source: `/bliuda/${s}`, destination: `/dishes/${d.slug}` }))),
  // Пустые карточки, которым нет замены, ведут в каталог, а не на 404
  ...[...new Set(skipped.map((s) => s.slug))]
    .filter((s) => !dishes.some((d) => d.slug === s || d.legacySlugs.includes(s)))
    .map((s) => ({ source: `/bliuda/${s}`, destination: "/dishes" })),
  ...Object.entries(LEGACY_POST_REDIRECTS).map(([from, to]) => ({ source: `/${from}`, destination: `/dishes/${to}` })),
];

const out: ContentFile = {
  source: "WordPress gastroguia.ru",
  cuisines: [...cuisineNames].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name, "ru")),
  dishes,
  skipped,
  redirects,
};
writeFileSync("content/dishes.json", JSON.stringify(out, null, 2) + "\n");

const withTr = dishes.filter((d) => Object.keys(d.translations).length).length;
console.log(`Блюд: ${dishes.length} (с переводами: ${withTr}), кухонь: ${out.cuisines.length}, пропущено: ${skipped.length}`);
for (const d of dishes) if (!d.course) console.warn(`  нет типа блюда: ${d.slug}`);
for (const d of dishes) if (!d.cuisine) console.warn(`  нет кухни: ${d.slug}`);
