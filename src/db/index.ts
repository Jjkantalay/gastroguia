import { connect, type Connection } from "./client";

const globalForDb = globalThis as unknown as { dbConnection?: Connection };

// Одно подключение на процесс, в том числе при hot reload в dev
const connection = globalForDb.dbConnection ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.dbConnection = connection;

export const db = connection.db;
