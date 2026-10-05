# Гастрогид

Новая версия gastroguia.ru: база блюд кухонь мира с рецептами, ингредиентами и КБЖУ, а также кулинарный ассистент на Claude.

## Стек

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4): сайт и API
- **PostgreSQL 16 + pgvector**: база блюд, полнотекстовый поиск по-русски, колонка под эмбеддинги для семантического поиска
- **Drizzle ORM**: схема и миграции
- **Claude API** (`@anthropic-ai/sdk`): ассистент, который ищет ответы по базе через инструменты

## Структура

```
src/
  db/schema.ts        схема БД: dishes, cuisines, ingredients, tags
  db/seed-data.ts     стартовые блюда (20 шт.)
  lib/dishes.ts       поиск и чтение блюд — общий слой для сайта, API и агента
  lib/agent.ts        ассистент: системный промпт и инструменты
  app/                страницы: /, /dishes, /dishes/[slug], /assistant
  app/api/            REST API: /api/dishes, /api/dishes/[slug], /api/agent
drizzle/              SQL-миграции
```

## Локальный запуск

Нужны Node.js 22 и PostgreSQL 16 с расширением pgvector (или Docker).

```bash
cp .env.example .env          # укажите DATABASE_URL и ANTHROPIC_API_KEY
npm install
npm run db:migrate            # создать таблицы
npm run db:seed               # загрузить стартовые блюда (можно запускать повторно)
npm run dev                   # http://localhost:3000
```

## API

| Запрос | Что делает |
|---|---|
| `GET /api/dishes?q=суп` | поиск по тексту (русская морфология) |
| `GET /api/dishes?cuisine=tayskaya&course=суп` | фильтр по кухне и типу блюда |
| `GET /api/dishes?vegetarian=true&glutenFree=true&maxTimeMin=30&maxCalories=400` | диета, время, калории |
| `GET /api/dishes?with=нут&without=чеснок` | есть или нет ингредиента (параметры можно повторять) |
| `GET /api/dishes/borshch` | полный рецепт |
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

- Перенос контента со старого WordPress (экспорт XML → скрипт импорта) с сохранением адресов и редиректами
- Эмбеддинги блюд и семантический поиск (колонка `dishes.embedding` и HNSW-индекс уже есть)
- Фотографии блюд и админка для редакторов
- Стриминг ответов ассистента
