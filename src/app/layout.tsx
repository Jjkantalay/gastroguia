import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://gastroguia.ru"),
  title: { default: "Гастрогид — твой виртуальный гид в мире кавказской кухни", template: "%s — Гастрогид" },
  description: "Мультилингвальная картотека блюд Кавказа: история, ингредиенты, аллергены и традиции подачи.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={plexMono.variable}>
      <body className="min-h-screen antialiased">
        <Header />
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
