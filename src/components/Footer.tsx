import { CONTACTS, SITE_ASSETS } from "@/lib/assets";

const SOCIAL = [
  { href: CONTACTS.telegram, icon: SITE_ASSETS.telegram, label: "Telegram" },
  { href: CONTACTS.vk, icon: SITE_ASSETS.vk, label: "ВКонтакте" },
  { href: CONTACTS.whatsapp, icon: SITE_ASSETS.whatsapp, label: "WhatsApp" },
];

export function Footer() {
  return (
    <footer id="contacts" className="mx-auto max-w-[1440px] px-4 py-10 sm:px-8">
      <div className="frame grid md:grid-cols-[1.2fr_1fr_auto]">
        <div className="flex flex-col gap-3 border-b-4 border-ink p-6 md:border-b-0 md:border-r-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SITE_ASSETS.logo} alt="Гастрогид" className="h-12 w-auto self-start" />
          <p className="font-serif text-2xl">Мультилингвальная картотека</p>
          <p className="text-sm">
            твой виртуальный гид в мире кавказской кухни
            <br />© ГАСТРОГИД, {new Date().getFullYear()}. Все права защищены
          </p>
        </div>
        <div className="flex flex-col gap-1 border-b-4 border-ink p-6 text-sm md:border-b-0 md:border-r-4">
          <p className="mb-2 font-serif text-2xl">Контакты</p>
          <p>{CONTACTS.company}</p>
          <a href={`mailto:${CONTACTS.email}`} className="hover:text-accent">{CONTACTS.email}</a>
          <a href={CONTACTS.phoneHref} className="hover:text-accent">{CONTACTS.phone}</a>
        </div>
        <div className="flex items-center justify-center gap-4 p-6">
          {SOCIAL.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              title={s.label}
              className="frame flex h-16 w-16 items-center justify-center rounded-[20px] hover:bg-light"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.icon} alt="" className="h-7 w-7" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
