// Фирменная графика старого сайта; файлы скачивает npm run images:download
const U = "/wp-content/uploads";

export const SITE_ASSETS = {
  logo: `${U}/2024/02/logo.svg`,
  paper: `${U}/2024/11/Frame-27.png`,
  quote: `${U}/2024/11/mask-group.svg`,
  fasie: `${U}/2025/02/fasie.svg`,
  telegram: `${U}/2025/03/vector-1.svg`,
  vk: `${U}/2025/03/vector.svg`,
  whatsapp: `${U}/2025/03/vector-2.svg`,
  fonts: [
    `${U}/2024/11/liberationserif.woff2`,
    `${U}/2024/11/liberationserif.woff`,
    `${U}/2024/11/liberationserif-bold.woff2`,
    `${U}/2024/11/liberationserif-bold.woff`,
  ],
  // Обложки кухонь из слайдера на главной
  cuisineCovers: [`${U}/2025/04/frame-42-1.jpg`, `${U}/2025/04/frame-41.jpg`, `${U}/2025/04/frame-40.jpg`],
} as const;

export const CUISINE_COVERS: Record<string, string> = {
  armyanskaya: `${U}/2025/04/frame-42-1.jpg`,
  gruzinskaya: `${U}/2025/04/frame-41.jpg`,
  chechenskaya: `${U}/2025/04/frame-40.jpg`,
};

export const CONTACTS = {
  company: "ООО «ДЕМОНОВ»",
  email: "Jorjanoo@yandex.ru",
  phone: "+7 (938) 312-71-71",
  phoneHref: "tel:+79383127171",
  telegram: "https://t.me/jorjanoo",
  vk: "https://vk.com/jorjanoo",
  // На старом сайте номер в ссылке WhatsApp отличается от телефона в контактах — уточнить
  whatsapp: "https://wa.me/79383127271",
  fasie: "https://fasie.ru/",
};
