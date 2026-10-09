import { connect } from "./client";

// Подхватываем .env при локальном запуске; в Docker переменные приходят из окружения
try {
  process.loadEnvFile();
} catch {}

const { migrate, close } = connect(undefined, { poolSize: 1 });
await migrate("./drizzle");
await close();
console.log("Миграции применены");
