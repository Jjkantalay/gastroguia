// Готовит файлы для импорта новых блюд в WordPress (Инструменты → Импорт → WordPress).
// Запуск: npm run export:wordpress
//
// Получается то же, что на сайте: запись типа «bliuda» с полями JetEngine (nazvanie, opisanie,
// istoriialevo, istoriiapravo, ingredienty-1, allergen1–3, foto), термин «kukhnia» и шаблон
// Elementor «СтраницаБлюда». Блюда, которые уже есть на сайте, не выгружаются.
//
//   wordpress/gastroguia-ru.xml  новые блюда на русском и новые кухни
//   wordpress/gastroguia-en.xml  английские версии с полями WPML Export and Import

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { ContentFile, ExtraFile, PhotosFile } from "../src/db/content";

// Шаблон Elementor, через который на сайте выводится каждое блюдо
const TEMPLATE_ID = Number(process.env.WP_TEMPLATE_ID ?? 6194);
const AUTHOR = process.env.WP_AUTHOR ?? "admin";
const SITE = "https://gastroguia.ru";
// Номера записей берём с запасом: импортёр всё равно выдаст свои, а связи внутри файла сохранит
const FIRST_ID = 900000;

type Lang = { code: string; cuisines: Record<string, string>; allergens: Record<string, string> };

const read = <T>(f: string): T => JSON.parse(readFileSync(`content/${f}`, "utf8"));
const main = read<ContentFile>("dishes.json");
const extra = read<ExtraFile>("dishes-extra.json");
const langs = read<{ languages: Lang[] }>("i18n.json").languages;
const photos: PhotosFile = existsSync("content/photos.json") ? read("photos.json") : {};

const cdata = (s: string) => `<![CDATA[${s.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const wpDate = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

// История на сайте выводится в две колонки — делим по предложениям примерно пополам
function splitHistory(text: string): [string, string] {
  const sentences = text.match(/[^.!?]+[.!?]+["»)]?\s*|[^.!?]+$/g) ?? [text];
  let left = "";
  for (const s of sentences) {
    if (left && left.length + s.length / 2 > text.length / 2) break;
    left += s;
  }
  return [left.trim(), text.slice(left.length).trim()];
}

// Полей для аллергенов на сайте три — если их больше, остальные идут в третье через запятую
function allergenFields(codes: string[], lang: Lang) {
  const words = codes.map((c) => capitalize(lang.allergens[c] ?? c));
  const slots = [words[0], words[1], words.slice(2).join(", ")];
  // Пустое поле на сайте заполняли прочерком
  return Object.fromEntries(slots.map((w, i) => [`allergen${i + 1}`, w || "-"]));
}

const meta = (fields: Record<string, string | number>) =>
  Object.entries(fields)
    .map(([k, v]) => `\t\t<wp:postmeta><wp:meta_key>${cdata(k)}</wp:meta_key><wp:meta_value>${cdata(String(v))}</wp:meta_value></wp:postmeta>`)
    .join("\n");

type Item = { id: number; title: string; slug: string; type: string; content: string; extraXml?: string; meta: Record<string, string | number>; parent?: number };

function itemXml(it: Item) {
  return `\t<item>
\t\t<title>${cdata(it.title)}</title>
\t\t<link>${SITE}/${it.type === "bliuda" ? "bliuda/" : ""}${it.slug}/</link>
\t\t<dc:creator>${cdata(AUTHOR)}</dc:creator>
\t\t<guid isPermaLink="false">${SITE}/?p=${it.id}</guid>
\t\t<description></description>
\t\t<content:encoded>${cdata(it.content)}</content:encoded>
\t\t<excerpt:encoded>${cdata("")}</excerpt:encoded>
\t\t<wp:post_id>${it.id}</wp:post_id>
\t\t<wp:post_date>${cdata(wpDate(now))}</wp:post_date>
\t\t<wp:post_date_gmt>${cdata(wpDate(now))}</wp:post_date_gmt>
\t\t<wp:comment_status>${cdata("closed")}</wp:comment_status>
\t\t<wp:ping_status>${cdata("closed")}</wp:ping_status>
\t\t<wp:post_name>${cdata(it.slug)}</wp:post_name>
\t\t<wp:status>${cdata(it.type === "attachment" ? "inherit" : "publish")}</wp:status>
\t\t<wp:post_parent>${it.parent ?? 0}</wp:post_parent>
\t\t<wp:menu_order>0</wp:menu_order>
\t\t<wp:post_type>${cdata(it.type)}</wp:post_type>
\t\t<wp:post_password>${cdata("")}</wp:post_password>
\t\t<wp:is_sticky>0</wp:is_sticky>
${it.extraXml ?? ""}${meta(it.meta)}
\t</item>`;
}

function wxr(language: string, terms: string, items: Item[]) {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<!-- Импорт в WordPress: Инструменты → Импорт → WordPress. Сделано scripts/json-to-wordpress.ts -->
<rss version="2.0"
\txmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
\txmlns:content="http://purl.org/rss/1.0/modules/content/"
\txmlns:wfw="http://wellformedweb.org/CommentAPI/"
\txmlns:dc="http://purl.org/dc/elements/1.1/"
\txmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
\t<title>Гастрогид</title>
\t<link>${SITE}</link>
\t<description></description>
\t<language>${language}</language>
\t<wp:wxr_version>1.2</wp:wxr_version>
\t<wp:base_site_url>${SITE}</wp:base_site_url>
\t<wp:base_blog_url>${SITE}</wp:base_blog_url>
\t<wp:author><wp:author_login>${cdata(AUTHOR)}</wp:author_login><wp:author_display_name>${cdata(AUTHOR)}</wp:author_display_name></wp:author>
${terms}
${items.map(itemXml).join("\n")}
</channel>
</rss>
`;
}

const ru = langs.find((l) => l.code === "ru")!;
const en = langs.find((l) => l.code === "en")!;
const cuisineName = new Map([...main.cuisines, ...(extra.cuisines ?? [])].map((c) => [c.slug, c.name]));

// Блюда, которые на сайте уже заполнены, не трогаем
const onSite = new Set(main.dishes.map((d) => d.slug));
const dishes = extra.dishes.filter((d) => !onSite.has(d.slug));

// Пустые карточки на сайте с тем же адресом: их надо удалить до импорта, иначе получится kubdari-2
const stubs = main.skipped.filter((s) => dishes.some((d) => d.slug === s.slug));

const used = [...new Set(dishes.map((d) => d.cuisine))];
const terms = used
  .map(
    (slug, i) => `\t<wp:term><wp:term_id>${FIRST_ID + i}</wp:term_id><wp:term_taxonomy>${cdata("kukhnia")}</wp:term_taxonomy><wp:term_slug>${cdata(slug)}</wp:term_slug><wp:term_parent>${cdata("")}</wp:term_parent><wp:term_name>${cdata(cuisineName.get(slug)!)}</wp:term_name></wp:term>`,
  )
  .join("\n");

const ruItems: Item[] = [];
const enItems: Item[] = [];
let nextId = FIRST_ID;
let withPhoto = 0;

for (const d of dishes) {
  const id = ++nextId;
  const category = `\t\t<category domain="kukhnia" nicename="${d.cuisine}">${cdata(cuisineName.get(d.cuisine)!)}</category>\n`;

  // Фото: импортёр сам скачает файл с Wikimedia Commons, если стоит галочка «Скачать и импортировать вложения»
  const photo = photos[d.slug];
  let photoId: number | null = null;
  if (photo?.original) {
    photoId = ++nextId;
    withPhoto++;
    ruItems.push({
      id: photoId,
      parent: id,
      title: d.name,
      slug: `${d.slug}-foto`,
      type: "attachment",
      content: `Фото: ${photo.author}, ${photo.license}. ${photo.source}`,
      extraXml: `\t\t<wp:attachment_url>${cdata(photo.original)}</wp:attachment_url>\n`,
      meta: { _wp_attachment_image_alt: d.name },
    });
  }

  const fields = (t: { name: string; description: string; history: string; ingredientsText: string }, lang: Lang) => {
    const [left, right] = splitHistory(t.history);
    return {
      nazvanie: t.name,
      ...(photoId ? { foto: photoId, _thumbnail_id: photoId } : {}),
      kukhnia: lang.cuisines[d.cuisine] ?? `${cuisineName.get(d.cuisine)} кухня`,
      opisanie: t.description,
      tsitata: "",
      "ingredienty-1": t.ingredientsText,
      "ingredienty-2": "",
      ...allergenFields(d.allergenCodes, lang),
      istoriialevo: left,
      istoriiapravo: right,
      // Как у блюд на сайте: WPML дублирует фото в переводы
      _wpml_media_duplicate: 1,
      _wpml_media_featured: 1,
    };
  };

  const content = `[elementor-template id="${TEMPLATE_ID}"]`;
  const group = `gastroguia-${d.slug}`;
  ruItems.push({
    id,
    title: d.name,
    slug: d.slug,
    type: "bliuda",
    content,
    extraXml: category,
    meta: { ...fields(d, ru), _wpml_import_language_code: "ru", _wpml_import_translation_group: group },
  });
  enItems.push({
    id: ++nextId,
    title: d.translations.en.name,
    slug: d.slug,
    type: "bliuda",
    content,
    extraXml: category,
    meta: {
      // Фото у английской версии проставит wordpress/gastroguia-fix-photos.php по русской записи
      ...Object.fromEntries(Object.entries(fields(d.translations.en, en)).filter(([k]) => k !== "foto" && k !== "_thumbnail_id")),
      _wpml_import_language_code: "en",
      _wpml_import_source_language_code: "ru",
      _wpml_import_translation_group: group,
    },
  });
}

mkdirSync("wordpress", { recursive: true });
writeFileSync("wordpress/gastroguia-ru.xml", wxr("ru-RU", terms, ruItems));
writeFileSync("wordpress/gastroguia-en.xml", wxr("en-US", "", enItems));

console.log(`Готово: блюд ${dishes.length}, с фото ${withPhoto}, новых кухонь ${used.filter((c) => !main.cuisines.some((m) => m.slug === c)).length}`);
console.log("  wordpress/gastroguia-ru.xml\n  wordpress/gastroguia-en.xml");
if (stubs.length) {
  console.log(`\nДо импорта удалите на сайте пустые карточки (Блюда → в корзину → очистить корзину), иначе адреса получат «-2»:`);
  for (const s of stubs) console.log(`  ${s.title} — ${SITE}/bliuda/${s.slug}/ (ID ${s.wpId})`);
}
if (withPhoto) console.log("\nПосле импорта включите wordpress/gastroguia-fix-photos.php — он проставит фото в поле «foto» (см. README)");
if (!withPhoto) console.log("\nФото не добавлены: сначала выполните npm run photos:fetch");
