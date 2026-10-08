# Гастрогид на C

Веб-сервер на чистом C без внешних библиотек. Отдаёт сайт в фирменном стиле gastroguia.ru, JSON-API, картинки и переадресует старые адреса WordPress.

## Запуск

Из корня проекта (там, где лежат `content/` и `public/`):

```
c\bin\gastroguia.exe    # Windows: готовая сборка лежит в репозитории
./gastroguia            # Linux/macOS, после sh c/build.sh
```

`c/bin/gastroguia.exe` пересобирается из `c/src` командой `sh c/build.sh` (нужен MinGW) или `c\build.bat` на Windows.

Сайт откроется на http://localhost:8080. Перед первым запуском скачайте фото и фирменную графику: `npm run images:download`.

Параметры:

| Ключ | По умолчанию | Что задаёт |
|---|---|---|
| `-p` | `8080` | порт |
| `-H` | `127.0.0.1` | адрес; `0.0.0.0` — доступ из сети |
| `-d` | `content/dishes.json` | данные о блюдах |
| `-r` | `public` | картинки и шрифты (`/wp-content/uploads/...`) |
| `-s` | `c/static` | стили и скрипт (`/static/...`) |

## Сборка

- Windows: `c\build.bat` (нужен gcc из [w64devkit](https://github.com/skeeto/w64devkit) или [WinLibs](https://winlibs.com))
- Linux/macOS: `sh c/build.sh`

## Адреса

| Адрес | Что отдаёт |
|---|---|
| `/` | главная: лента кухонь, поиск, разделы по кухням |
| `/dishes?q=тыква&cuisine=armyanskaya&course=выпечка&no_gluten=1` | каталог с фильтрами |
| `/dishes/plov` | страница блюда |
| `?lang=en`, `?lang=es` | английская и испанская версии любой страницы |
| `/api/dishes`, `/api/dishes/plov` | JSON |
| `/bliuda/...`, `/kukhnia/...`, `/hingalsh/` | 301 на новые адреса |

## Устройство

```
c/src/main.c    сеть, разбор запросов, маршруты, раздача файлов, редиректы
c/src/pages.c   HTML-шаблоны страниц и JSON-API
c/src/site.c    загрузка блюд, поиск без учёта регистра (ё = е), фильтры
c/src/i18n.c    подписи интерфейса на русском, английском и испанском
c/src/json.c    разбор JSON
c/src/buf.c     строковый буфер и экранирование HTML/JSON/URL
c/static/       style.css и site.js
```

Сервер однопоточный и отвечает с `Connection: close`. Для продакшена его ставят за nginx или Caddy, которые берут на себя HTTPS, сжатие и медленных клиентов.

В этой версии нет ассистента на Claude: для него нужен HTTPS-клиент (libcurl или OpenSSL). Он остаётся в Next.js-версии в корне проекта.
