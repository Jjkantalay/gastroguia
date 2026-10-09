// Подбирает фото блюд со свободной лицензией на Wikimedia Commons и записывает авторов в content/photos.json.
//
// Порядок поиска, от самого точного:
// 1. Wikidata: ищет элемент по английскому, русскому и родному названию (грузинскому, армянскому,
//    азербайджанскому, персидскому, турецкому). Берёт основное фото (P18) только у элемента, который
//    действительно еда: его класс (P31/P279) или описание — блюдо, хлеб, суп, напиток, сыр и т. п.
//    Элементы, у которых название совпадает с названием блюда, идут первыми.
// 2. Википедия: главное фото статьи с точно таким названием (сначала русская, потом английская
//    и родная). Это фото выбрали редакторы статьи, обычно оно точное.
// 3. Поиск файла на Commons. Такие фото помечаются review: true, их стоит просмотреть.
// Берутся только CC0, общественное достояние, CC BY и CC BY-SA. Файлы сохраняются в public/images/dishes/.
//
// Запуск: node scripts/fetch-photos.mjs [--limit 50] [--only slug,slug] [--recheck] [--dry-run]
//   --recheck  заново подобрать фото, помеченные review: true

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const WIKIDATA = process.env.WIKIDATA_API ?? "https://www.wikidata.org/w/api.php";
const COMMONS = process.env.COMMONS_API ?? "https://commons.wikimedia.org/w/api.php";
// {lang} заменяется на код языка Википедии
const WIKIPEDIA = process.env.WIKIPEDIA_API ?? "https://{lang}.wikipedia.org/w/api.php";
// Wikimedia требует понятный User-Agent с контактом
const UA = "GastroguiaPhotoFetcher/1.1 (https://gastroguia.ru; Jorjanoo@yandex.ru)";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const limit = Number(opt("--limit") ?? Infinity);
const only = opt("--only")?.split(",");
const dryRun = args.includes("--dry-run");
const recheck = args.includes("--recheck");

const main = JSON.parse(readFileSync("content/dishes.json", "utf8"));
const extra = JSON.parse(readFileSync("content/dishes-extra.json", "utf8"));
const photosPath = "content/photos.json";
const photos = existsSync(photosPath) ? JSON.parse(readFileSync(photosPath, "utf8")) : {};

const FOOD = /\b(dish|dishes|food|foods|cuisine|bread|flatbread|soup|stew|pastry|pastries|pie|cheese|drink|beverage|sauce|condiment|dessert|sweet|confection|confectionery|kebab|kabob|salad|dumpling|sausage|porridge|pudding|cake|candy|yogurt|yoghurt|tea|coffee|noodle|noodles|pilaf|rice|meal|snack|appetizer|starter|paste|jam|preserve|halva|nougat|cookie|biscuit|meatball|omelette|casserole|beer|fermented|dairy|spice|seasoning|pickle|kefir)\b/i;
const FOOD_RU = /(блюд|еда|кухн|хлеб|лепёш|лепеш|суп|похлёб|похлеб|рагу|выпечк|пирог|сыр|напит|соус|приправ|десерт|сладост|кебаб|шашлык|салат|пельмен|колбас|каша|пудинг|торт|йогурт|кисломол|чай|кофе|лапш|плов|закуск|паст|варень|халв|печень|фрикадел|омлет|запеканк|пиво)/i;
const FREE = /^(cc0|public domain|pd\b|pd-|cc[ -]by(-sa)?([ -][0-9.]+)?)/i;

// Родной язык кухни: на нём у блюда часто есть статья и подписанное фото
const NATIVE = {
  gruzinskaya: "ka",
  armyanskaya: "hy",
  azerbajdzhanskaya: "az",
  iranskaya: "fa",
  turetskaya: "tr",
};

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
const norm = (s) => (s ?? "").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const claimIds = (e, prop) => (e?.claims?.[prop] ?? []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);

// Подписи классов (P31/P279) по-английски, с кешем: «food», «dish», «bread»…
const classLabels = new Map();
async function labelsOf(ids) {
  const need = ids.filter((id) => !classLabels.has(id));
  for (let i = 0; i < need.length; i += 50) {
    const chunk = need.slice(i, i + 50);
    const res = await api(WIKIDATA, { action: "wbgetentities", ids: chunk.join("|"), props: "labels|descriptions", languages: "en" });
    for (const id of chunk) {
      const e = res.entities?.[id];
      classLabels.set(id, `${e?.labels?.en?.value ?? ""} ${e?.descriptions?.en?.value ?? ""}`);
    }
  }
  return ids.map((id) => classLabels.get(id) ?? "");
}

async function fromWikidata(names) {
  const ids = [];
  for (const { lang, name } of names) {
    const found = await api(WIKIDATA, { action: "wbsearchentities", search: name, language: lang, uselang: lang, type: "item", limit: "7" });
    for (const s of found.search ?? []) if (!ids.includes(s.id)) ids.push(s.id);
  }
  if (!ids.length) return null;
  const ent = await api(WIKIDATA, { action: "wbgetentities", ids: ids.slice(0, 50).join("|"), props: "claims|descriptions|labels|aliases", languages: "en|ru|ka|hy|az|fa|tr" });
  const wanted = new Set(names.map((n) => norm(n.name)));
  const candidates = [];
  for (const [order, id] of ids.entries()) {
    const e = ent.entities?.[id];
    const file = e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!file) continue;
    const desc = `${e.descriptions?.en?.value ?? ""} ${e.descriptions?.ru?.value ?? ""}`;
    const classes = await labelsOf([...claimIds(e, "P31"), ...claimIds(e, "P279")]);
    const isFood = FOOD.test(desc) || FOOD_RU.test(desc) || classes.some((c) => FOOD.test(c));
    if (!isFood) continue;
    const titles = [...Object.values(e.labels ?? {}).map((l) => l.value), ...Object.values(e.aliases ?? {}).flat().map((a) => a.value)];
    const exact = titles.some((t) => wanted.has(norm(t)));
    candidates.push({ file, how: `wikidata:${id}`, score: (exact ? 100 : 0) - order });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

// Главное фото статьи Википедии с точным названием блюда (перенаправления учитываются)
async function fromWikipedia(names) {
  for (const { lang, name } of names) {
    const res = await api(WIKIPEDIA.replace("{lang}", lang), { action: "query", titles: name, redirects: "1", prop: "pageimages|pageprops", piprop: "name", ppprop: "disambiguation" });
    const page = Object.values(res.query?.pages ?? {})[0];
    if (!page || page.missing !== undefined || page.pageprops?.disambiguation !== undefined || !page.pageimage) continue;
    return { file: page.pageimage, how: `wikipedia:${lang}:${page.title}` };
  }
  return null;
}

async function fromCommonsSearch(name) {
  const res = await api(COMMONS, { action: "query", list: "search", srsearch: `${name} filetype:bitmap`, srnamespace: "6", srlimit: "10" });
  const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const hit = (res.query?.search ?? []).find((r) => words.every((w) => r.title.toLowerCase().includes(w)))
    ?? (res.query?.search ?? []).find((r) => words.some((w) => r.title.toLowerCase().includes(w)));
  return hit ? { file: hit.title.replace(/^File:/, ""), how: "commons-search", review: true } : null;
}

async function imageInfo(file) {
  const res = await api(COMMONS, { action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|extmetadata|mime|size", iiurlwidth: "1200" });
  const page = Object.values(res.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  // Файла нет на Commons — например, несвободное фото, загруженное только в Википедию
  if (!info) return { rejected: "нет на Commons" };
  const meta = info.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (!FREE.test(license)) return { rejected: license || "лицензия не указана" };
  if (!/^image\/(jpeg|png|webp)$/.test(info.mime)) return { rejected: `формат ${info.mime}` };
  if (info.width && info.width < 400) return { rejected: `маленькое фото ${info.width}px` };
  return {
    url: info.thumburl ?? info.url,
    ext: info.mime === "image/png" ? "png" : info.mime === "image/webp" ? "webp" : "jpg",
    author: stripHtml(meta.Artist?.value) || stripHtml(meta.Credit?.value) || "Wikimedia Commons",
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
    source: info.descriptionurl,
  };
}

const translationName = (lang, slug) => {
  const path = `content/translations/${lang}.json`;
  if (!existsSync(path)) return undefined;
  translationName.cache ??= {};
  translationName.cache[lang] ??= JSON.parse(readFileSync(path, "utf8"));
  return translationName.cache[lang][slug]?.name;
};

// Названия для поиска: английское, русское и родное; скобки вроде «Абгушт (дизи)» убираем
const clean = (s) => (s ?? "").replace(/\s*\(.*\)\s*$/, "").trim();
const dishes = [
  ...main.dishes.map((d) => ({ slug: d.slug, cuisine: d.cuisine, en: d.translations?.en?.name ?? d.name, ru: d.name })),
  ...extra.dishes.map((d) => ({ slug: d.slug, cuisine: d.cuisine, en: d.translations.en.name, ru: d.name })),
];
function namesOf(d) {
  const out = [{ lang: "en", name: clean(d.en) }, { lang: "ru", name: clean(d.ru) }];
  const native = NATIVE[d.cuisine];
  const nativeName = native && clean(extra.names?.[d.slug]?.[native] ?? translationName(native, d.slug));
  if (nativeName) out.push({ lang: native, name: nativeName });
  return out.filter((n, i) => n.name && out.findIndex((m) => m.lang === n.lang && m.name === n.name) === i);
}

const withImage = new Set(main.dishes.filter((d) => d.image).map((d) => d.slug));
const todo = dishes
  .filter((d) => !withImage.has(d.slug) && (!photos[d.slug] || (recheck && photos[d.slug].review)) && (!only || only.includes(d.slug)))
  .slice(0, limit);

mkdirSync("public/images/dishes", { recursive: true });
let ok = 0;
const missed = [];
for (const d of todo) {
  const names = namesOf(d);
  // Википедию спрашиваем сначала по-русски: у кавказских блюд там самые подробные статьи
  const wikiNames = [...names.filter((n) => n.lang === "ru"), ...names.filter((n) => n.lang !== "ru")];
  try {
    let info = null;
    let pick = null;
    const rejected = [];
    for (const find of [() => fromWikidata(names), () => fromWikipedia(wikiNames), () => fromCommonsSearch(names[0].name)]) {
      const p = await find();
      if (!p) continue;
      const i = await imageInfo(p.file);
      if (i.rejected) { rejected.push(`${p.file} — ${i.rejected}`); continue; }
      [pick, info] = [p, i];
      break;
    }
    if (!pick) { missed.push(`${d.slug}: ${rejected.length ? rejected.join("; ") : "не найдено"}`); continue; }
    const image = `/images/dishes/${d.slug}.${info.ext}`;
    if (!dryRun) {
      const res = await fetch(info.url, { headers: { "User-Agent": UA } });
      if (!res.ok) { missed.push(`${d.slug}: скачивание ${res.status}`); continue; }
      writeFileSync(`public${image}`, Buffer.from(await res.arrayBuffer()));
      photos[d.slug] = { image, author: info.author, license: info.license, licenseUrl: info.licenseUrl, source: info.source, original: info.url, found: pick.how, ...(pick.review ? { review: true } : {}) };
      writeFileSync(photosPath, JSON.stringify(photos, null, 1) + "\n");
    }
    ok++;
    console.log(`  ${d.slug}: ${pick.file} (${info.license}, ${pick.how}${pick.review ? ", проверить" : ""})`);
  } catch (e) {
    missed.push(`${d.slug}: ${e.message}`);
  }
  await sleep(300); // бережём API Wikimedia
}

console.log(`\nФото найдено: ${ok} из ${todo.length}. Всего в photos.json: ${Object.keys(photos).length}`);
if (missed.length) console.log(`Не найдено (${missed.length}):\n  ` + missed.join("\n  "));
const review = Object.entries(photos).filter(([, p]) => p.review).map(([s]) => s);
if (review.length) console.log(`\nНайдены поиском по Commons, стоит проверить глазами (страница /photos): ${review.join(", ")}`);
