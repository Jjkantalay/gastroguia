import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });
const lora = Lora({ subsets: ["latin", "cyrillic"], variable: "--font-lora" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://gastroguia.ru"),
  title: { default: "Гастрогид — путеводитель по блюдам Кавказа", template: "%s — Гастрогид" },
  description: "Истории, ингредиенты и традиции блюд грузинской, армянской, азербайджанской и чеченской кухни.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${lora.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-line">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-4">
            <Link href="/" className="font-serif text-xl font-semibold">
              Гастро<span className="text-accent">гид</span>
            </Link>
            <div className="ml-auto flex gap-5 text-sm">
              <Link href="/dishes" className="hover:text-accent">Блюда</Link>
              <Link href="/assistant" className="hover:text-accent">Ассистент</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-xs text-muted">
          © {new Date().getFullYear()} Гастрогид
        </footer>
      </body>
    </html>
  );
}
