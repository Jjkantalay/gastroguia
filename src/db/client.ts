import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzlePostgres<typeof schema>>;

export type Connection = {
  db: Db;
  migrate: (migrationsFolder: string) => Promise<void>;
  close: () => Promise<void>;
};

const PGLITE_PREFIX = "pglite:";

// DATABASE_URL вида postgres://… — обычный PostgreSQL (сервер, Docker).
// DATABASE_URL вида pglite:./.pglite — встроенный PostgreSQL в папке проекта, для разработки
// без установки базы. С папкой PGlite одновременно может работать только один процесс.
export function connect(url = process.env.DATABASE_URL, { poolSize = 10 } = {}): Connection {
  if (!url) throw new Error("Не задан DATABASE_URL — скопируйте .env.example в .env");

  if (url.startsWith(PGLITE_PREFIX)) {
    const dir = url.slice(PGLITE_PREFIX.length).replace(/^\/\//, "") || "./.pglite";
    const client = new PGlite(dir, { extensions: { vector } });
    const db = drizzlePglite(client, { schema });
    return {
      // API запросов у драйверов одинаковый, различаются только типы результатов выполнения
      db: db as unknown as Db,
      migrate: (migrationsFolder) => migratePglite(db, { migrationsFolder }),
      close: () => client.close(),
    };
  }

  const client = postgres(url, { max: poolSize, onnotice: () => {} });
  const db = drizzlePostgres(client, { schema });
  return {
    db,
    migrate: (migrationsFolder) => migratePostgres(db, { migrationsFolder }),
    close: () => client.end(),
  };
}
