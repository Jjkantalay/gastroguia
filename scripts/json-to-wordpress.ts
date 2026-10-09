// Готовит файлы для импорта блюд в WordPress (Инструменты → Импорт → WordPress).
// Запуск: npm run export:wordpress
//
// Получается то же, что на сайте: запись типа «bliuda» с полями JetEngine (nazvanie, opisanie,
// tsitata, istoriialevo, istoriiapravo, ingredienty-1, allergen1–3, foto), термин «kukhnia» и шаблон
// Elementor «СтраницаБлюда».
//
//   wordpress/gastroguia-ru.xml    новые блюда на русском и новые кухни
//   wordpress/gastroguia-<яз>.xml  переводы на 19 языков: новых блюд и тех, что уже есть на сайте
//                                  (кроме английской и испанской версий старых блюд — они на сайте есть)
//
// Переводы связывает с русскими записями mu-плагин wordpress/gastroguia-after-import.php через API WPML:
// по полям _gastroguia_lang и _gastroguia_slug он находит русскую запись, ставит язык, возвращает адрес
// без «-2» и копирует фото.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { ContentFile, ExtraFile, PhotosFile, TranslationsFile } from "../src/db/content";

// Шаблон Elementor, через который на сайте выводится каждое блюдо
const TEMPLATE_ID = Number(process.env.WP_TEMPLATE_ID ?? 6194);
const AUTHOR = process.env.WP_AUTHOR ?? "admin";
const SITE = "https://gastroguia.ru";
// Номера записей берём с запасом: импортёр всё равно выдаст свои, а связи внутри файла сохранит
const FIRST_ID = 900000;

type Lang = { code: string; name: string; cuisines: Record<string, string>; allergens: Record<string, string> };

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

// История на сайте выводится в две колонки — делим по предложениям примерно пополам.
// Концы предложений: латиница и кириллица, китайский и японский «。», хинди «।», арабский «؟»
function splitHistory(text: string): [string, string] {
  const sentences = text.match(/[^.!?。！？।؟]+[.!?。！？।؟]+["»)」]?\s*|[^.!?。！？।؟]+$/g) ?? [text];
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

type Item = { id: number; title: string; slug: string; type: string; date: string; content: string; extraXml?: string; meta: Record<string, string | number>; parent?: number };

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
\t\t<wp:post_date>${cdata(it.date)}</wp:post_date>
\t\t<wp:post_date_gmt>${cdata(it.date)}</wp:post_date_gmt>
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
const cuisineName = new Map([...main.cuisines, ...(extra.cuisines ?? [])].map((c) => [c.slug, c.name]));
const translationsOf = (code: string): TranslationsFile =>
  existsSync(`content/translations/${code}.json`) ? read(`translations/${code}.json`) : {};
const enTranslations = translationsOf("en");

// Блюда, которые на сайте уже заполнены: русские записи не трогаем, добавляем только новые языки
const onSite = new Set(main.dishes.map((d) => d.slug));
const dishes = extra.dishes.filter((d) => !onSite.has(d.slug));

// Пустые карточки на сайте с тем же адресом: их надо удалить до импорта, иначе получится kubdari-2
const stubs = main.skipped.filter((s) => dishes.some((d) => d.slug === s.slug));

// Аллергены старых блюд записаны русскими словами — переводим в коды по первым буквам
const ruAllergen = Object.entries(ru.allergens);
const allergenCodes = (words: string[]) =>
  words.map((w) => ruAllergen.find(([, v]) => v.slice(0, 4) === w.toLowerCase().slice(0, 4))?.[0]).filter((c): c is string => !!c);

const used = [...new Set(dishes.map((d) => d.cuisine))];
const terms = used
  .map(
    (slug, i) => `\t<wp:term><wp:term_id>${FIRST_ID + i}</wp:term_id><wp:term_taxonomy>${cdata("kukhnia")}</wp:term_taxonomy><wp:term_slug>${cdata(slug)}</wp:term_slug><wp:term_parent>${cdata("")}</wp:term_parent><wp:term_name>${cdata(cuisineName.get(slug)!)}</wp:term_name></wp:term>`,
  )
  .join("\n");

type Texts = { name: string; description: string; quote?: string | null; history?: string | null; ingredientsText?: string | null };
// wpSlug — адрес записи на сайте (у старых блюд бывает другим: dolma, lobio-2), ruIds — номера их записей
type Source = { slug: string; wpSlug: string; ruIds: number[]; cuisine: string; allergenCodes: string[]; texts: Record<string, Texts | undefined>; isNew: boolean; onSite: Set<string> };

// Все блюда с текстами по языкам: русский, английский и content/translations/<язык>.json
const sources: Source[] = [
  ...main.dishes.map((d) => ({
    slug: d.slug,
    wpSlug: d.legacySlugs[0] ?? d.slug,
    ruIds: d.wpIds,
    cuisine: d.cuisine ?? "",
    allergenCodes: allergenCodes(d.allergens),
    texts: { ru: d, ...d.translations } as Record<string, Texts | undefined>,
    isNew: false,
    onSite: new Set(Object.keys(d.translations)),
  })),
  ...dishes.map((d) => ({ slug: d.slug, wpSlug: d.slug, ruIds: [] as number[], cuisine: d.cuisine, allergenCodes: d.allergenCodes, texts: { ru: d, en: d.translations.en } as Record<string, Texts | undefined>, isNew: true, onSite: new Set<string>() })),
];
for (const l of langs) {
  if (l.code === "ru") continue;
  const file = translationsOf(l.code);
  for (const s of sources) {
    const t = file[s.slug];
    // Пустые поля перевода дополняем английскими, затем русскими
    const base = s.texts[l.code] ?? s.texts.en ?? enTranslations[s.slug];
    if (t || base) s.texts[l.code] = { ...base, ...Object.fromEntries(Object.entries(t ?? {}).filter(([, v]) => v)) } as Texts;
  }
}

const content = `[elementor-template id="${TEMPLATE_ID}"]`;
let nextId = FIRST_ID;
let withPhoto = 0;
const files = new Map<string, Item[]>(langs.map((l) => [l.code, []]));

function fields(s: Source, t: Texts, lang: Lang) {
  const [left, right] = splitHistory(t.history ?? "");
  return {
    nazvanie: t.name,
    kukhnia: lang.cuisines[s.cuisine] ?? `${cuisineName.get(s.cuisine)} кухня`,
    opisanie: t.description,
    tsitata: t.quote ?? "",
    "ingredienty-1": t.ingredientsText ?? "",
    "ingredienty-2": "",
    ...allergenFields(s.allergenCodes, lang),
    istoriialevo: left,
    istoriiapravo: right,
    // Как у блюд на сайте: WPML дублирует фото в переводы
    _wpml_media_duplicate: 1,
    _wpml_media_featured: 1,
  };
}

for (const [li, lang] of langs.entries()) {
  // Импортёр считает запись дублем, если совпали заголовок, текст и дата, — поэтому у каждого языка своя минута
  const date = wpDate(new Date(now.getTime() + li * 60_000));
  for (const s of sources) {
    const t = s.texts[lang.code];
    if (!t?.name || !t.description) continue;
    // Старые блюда: русская запись и переводы из WPML (английский, испанский) на сайте уже есть
    if (!s.isNew && (lang.code === "ru" || s.onSite.has(lang.code))) continue;
    const items = files.get(lang.code)!;
    const id = ++nextId;
    const category = `\t\t<category domain="kukhnia" nicename="${s.cuisine}">${cdata(cuisineName.get(s.cuisine) ?? s.cuisine)}</category>\n`;

    // Фото только у новых русских записей; переводам его скопирует mu-плагин
    const photo = photos[s.slug];
    let photoId: number | null = null;
    if (lang.code === "ru" && photo?.original) {
      photoId = ++nextId;
      withPhoto++;
      items.push({
        id: photoId,
        parent: id,
        title: t.name,
        slug: `${s.slug}-foto`,
        type: "attachment",
        date,
        content: `Фото: ${photo.author}, ${photo.license}. ${photo.source}`,
        extraXml: `\t\t<wp:attachment_url>${cdata(photo.original)}</wp:attachment_url>\n`,
        meta: { _wp_attachment_image_alt: t.name },
      });
    }

    const group = `gastroguia-${s.slug}`;
    items.push({
      id,
      title: t.name,
      slug: s.wpSlug,
      type: "bliuda",
      date,
      content,
      extraXml: category,
      meta: {
        ...fields(s, t, lang),
        ...(photoId ? { foto: photoId, _thumbnail_id: photoId } : {}),
        _gastroguia_lang: lang.code,
        _gastroguia_slug: s.wpSlug,
        // Старые блюда: среди этих записей плагин найдёт русскую
        ...(s.ruIds.length ? { _gastroguia_ru_ids: s.ruIds.join(",") } : {}),
        // Те же связи для плагина WPML Export and Import, если удобнее им
        _wpml_import_language_code: lang.code,
        ...(lang.code === "ru" ? {} : { _wpml_import_source_language_code: "ru" }),
        _wpml_import_translation_group: group,
      },
    });
  }
}

mkdirSync("wordpress", { recursive: true });
const written: string[] = [];
for (const lang of langs) {
  const items = files.get(lang.code)!;
  if (!items.length) continue;
  const path = `wordpress/gastroguia-${lang.code}.xml`;
  writeFileSync(path, wxr(lang.code, lang.code === "ru" ? terms : "", items));
  written.push(`  ${path.padEnd(30)} ${lang.name}: записей ${items.filter((i) => i.type === "bliuda").length}`);
}

console.log(`Готово: новых блюд ${dishes.length}, с фото ${withPhoto}, новых кухонь ${used.filter((c) => !main.cuisines.some((m) => m.slug === c)).length}`);
console.log(written.join("\n"));
if (stubs.length) {
  console.log(`\nДо импорта удалите на сайте пустые карточки (Блюда → в корзину → очистить корзину), иначе адреса получат «-2»:`);
  for (const s of stubs) console.log(`  ${s.title} — ${SITE}/bliuda/${s.slug}/ (ID ${s.wpId})`);
}
console.log("\nПосле импорта включите wordpress/gastroguia-after-import.php — он свяжет переводы в WPML и проставит фото (см. README)");
if (!withPhoto) console.log("Фото не добавлены: сначала выполните npm run photos:fetch");
