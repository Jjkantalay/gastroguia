"use client";

import Link from "next/link";
import { useState } from "react";
import { CONTACTS, SITE_ASSETS } from "@/lib/assets";

const NAV = [
  { href: "/", label: "Главная" },
  { href: "/dishes", label: "Блюда" },
  { href: "/assistant", label: "Гид" },
  { href: "#contacts", label: "Контакты" },
];

function IconButton({ label, children, ...rest }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button aria-label={label} title={label} className="flex h-10 w-10 items-center justify-center" {...rest}>
      {children}
    </button>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b-4 border-ink">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-1 sm:gap-4">
          <IconButton label={open ? "Закрыть меню" : "Открыть меню"} aria-expanded={open} onClick={() => setOpen(!open)}>
            <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
              <path d="M0 2h28M0 10h28M0 18h28" stroke="currentColor" strokeWidth="3" />
            </svg>
          </IconButton>
          {/* Переключатель языка появится вместе с английской и испанской версиями */}
          <span className="hidden text-sm font-semibold sm:inline">RU</span>
        </div>

        <Link href="/" className="justify-self-center" aria-label="Гастрогид — на главную">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SITE_ASSETS.logo} alt="Гастрогид" className="h-10 w-auto sm:h-14" />
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <a href={CONTACTS.fasie} target="_blank" rel="noopener noreferrer" className="hidden md:block" title="Фонд содействия инновациям">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SITE_ASSETS.fasie} alt="Фонд содействия инновациям" className="h-10 w-auto" />
          </a>
          <Link href="/dishes" aria-label="Поиск блюд" title="Поиск блюд" className="flex h-10 w-10 items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2.5" />
              <path d="M15.5 15.5 22 22" stroke="currentColor" strokeWidth="2.5" />
            </svg>
          </Link>
        </div>
      </div>

      {open && (
        <nav className="border-t-4 border-ink">
          <ul className="mx-auto flex max-w-[1440px] flex-col sm:flex-row sm:justify-center">
            {NAV.map((item) => (
              <li key={item.href} className="border-b-4 border-ink last:border-b-0 sm:border-b-0 sm:border-l-4 sm:last:border-r-4">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block px-6 py-3 text-center font-bold uppercase hover:bg-ink hover:text-light"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
