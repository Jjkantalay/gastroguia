import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

// Одно подключение на процесс, в том числе при hot reload в dev
const client = globalForDb.pg ?? postgres(process.env.DATABASE_URL!, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { client as pg };
