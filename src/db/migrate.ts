import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Подхватываем .env при локальном запуске; в Docker переменные приходят из окружения
try {
  process.loadEnvFile();
} catch {}

const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
await client.end();
console.log("Миграции применены");
