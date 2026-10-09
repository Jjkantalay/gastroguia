import { readFileSync } from "node:fs";
import { join } from "node:path";

// Языки и подписи интерфейса — из content/i18n.json (тот же файл читает версия на C).
// Первым идёт русский, вторым английский: на них откатываемся, если перевода нет.
export type Language = {
  code: string;
  name: string;
  dir: "ltr" | "rtl";
  labels: Record<string, string>;
  cuisines: Record<string, string>;
};

let cache: Language[] | null = null;
export function languages(): Language[] {
  cache ??= (JSON.parse(readFileSync(join(process.cwd(), "content", "i18n.json"), "utf8")) as { languages: Language[] }).languages;
  return cache;
}

// Неизвестный или пустой код — русский
export function language(code: string | null | undefined): Language {
  const all = languages();
  return all.find((l) => l.code === code) ?? all[0];
}

export function label(lang: Language, key: string): string {
  return lang.labels[key] ?? languages()[1].labels[key] ?? languages()[0].labels[key] ?? key;
}

export function cuisineLabel(lang: Language, slug: string, fallback: string): string {
  return lang.cuisines[slug] ?? fallback;
}
