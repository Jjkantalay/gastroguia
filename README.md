# Гастрогид

Новая версия gastroguia.ru — путеводителя по блюдам Кавказа: описания, история, ингредиенты и аллергены, переводы на английский и испанский, а также ассистент на Claude.

## Стек

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4): сайт и API
- **PostgreSQL 16 + pgvector**: база блюд, полнотекстовый поиск по-русски, колонка под эмбеддинги для семантического поиска
- **Drizzle ORM**: схема и миграции
- **Claude API** (`@anthropic-ai/sdk`): ассистент, который ищет ответы по базе через инструменты

## Структура

```
src/
  db/schema.ts        схема БД: dishes, cuisines, ingredients, tags
  db/seed.ts          загрузка content/dishes.json в базу
  lib/dishes.ts       поиск и чтение блюд — общий слой для сайта, API и агента
  lib/agent.ts        ассистент: системный промпт и инструменты
  app/                страницы: /, /dishes, /dishes/[slug], /assistant
  app/api/            REST API: /api/dishes, /api/dishes/[slug], /api/agent
content/dishes.json   контент, перенесённый со старого сайта
scripts/              перенос с WordPress и скачивание фото
drizzle/              SQL-миграции
```

## Локальный запуск

Нужны Node.js 22 и PostgreSQL 16 с расширением pgvector (или Docker).

```bash
cp .env.example .env          # укажите DATABASE_URL и ANTHROPIC_API_KEY
npm install
npm run db:migrate            # создать таблицы
npm run db:seed               # загрузить content/dishes.json (можно запускать повторно)
npm run dev                   # http://localhost:3000
```

## Перенос с WordPress

```bash
npm run import:wordpress -- путь/к/экспорту.xml   # XML → content/dishes.json
npm run images:download                            # фото → public/wp-content/uploads/...
npm run db:seed
```

Берутся записи типа «Блюда» (JetEngine) с описанием. Английские и испанские версии WPML становятся переводами русской записи. Пустые карточки, записи блога и страницы пропускаются: список пропущенного лежит в `skipped` внутри JSON. Тип блюда в WordPress не хранился, он задан вручную в `scripts/wordpress-to-json.ts`.

Старые адреса переадресуются постоянными редиректами: `/bliuda/<слаг>/` → `/dishes/<слаг>`, переименованные карточки (`lobio-2` → `lobio` и т. п.) — по списку `redirects` из JSON, `/kukhnia/<слаг>/` → каталог с фильтром по кухне.

Фото лежат по тем же путям `/wp-content/uploads/...`, что и раньше, поэтому старые ссылки на картинки тоже продолжат работать. Скачайте их до переключения домена и закоммитьте папку `public/wp-content`. Пока фото не скачаны, можно отдавать их со старого сайта: `LEGACY_IMAGE_ORIGIN=https://старый-адрес`.

Сам XML в репозиторий не кладите: в нём email администратора и служебные данные (`*.xml` в `.gitignore`).

## API

| Запрос | Что делает |
|---|---|
| `GET /api/dishes?q=суп` | поиск по тексту (русская морфология) |
| `GET /api/dishes?cuisine=gruzinskaya&course=выпечка` | фильтр по кухне и типу блюда |
| `GET /api/dishes?vegetarian=true&glutenFree=true&maxTimeMin=30&maxCalories=400` | диета, время, калории |
| `GET /api/dishes?with=тыква&without=мясо` | есть или нет ингредиента (параметры можно повторять) |
| `GET /api/dishes/plov` | всё о блюде, включая переводы |
| `POST /api/agent` `{"messages":[{"role":"user","content":"..."}]}` | ответ ассистента |

У ассистента три инструмента: `search_dishes`, `get_dish` и `list_cuisines`. Они вызывают те же функции, что и сайт, поэтому новый инструмент для агента добавляется в `src/lib/agent.ts` поверх `src/lib/dishes.ts`.

## Развёртывание на VPS

```bash
git clone … && cd gastroguia
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
docker compose up -d db
docker compose run --rm migrate   # миграции и стартовые данные
docker compose up -d app          # сайт на 127.0.0.1:3000
```

Снаружи сайт открывается через nginx или Caddy с HTTPS: проксируйте домен на `127.0.0.1:3000`.

## Дальше

- Страницы на английском и испанском (переводы уже в базе, таблица `dish_translations`)
- Заполнить пустые карточки со старого сайта (шашлык, кубдари, аджапсандали и др.)
- Разобрать ингредиенты на «продукт + количество» (сейчас это текст)
- Эмбеддинги блюд и семантический поиск (колонка `dishes.embedding` и HNSW-индекс уже есть)
- Админка для редакторов
- Стриминг ответов ассистента
