import { env } from "@pixellize/core/env";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.js";

export type Database = MySql2Database<typeof schema>;

let pool: mysql.Pool | undefined;
let dbInstance: Database | undefined;

/** Lazily create a shared connection pool + Drizzle instance. */
export function getDb(): Database {
  if (dbInstance) return dbInstance;
  pool = mysql.createPool({
    uri: env.DATABASE_URL,
    connectionLimit: 10,
    // DATETIME columns are stored/compared in UTC by the app layer.
    timezone: "Z",
  });
  dbInstance = drizzle(pool, { schema, mode: "default" });
  return dbInstance;
}

/** Close the pool (used by tests / graceful shutdown). */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  dbInstance = undefined;
}

/** Create an independent pool + Drizzle instance for a specific URL (tests, scripts). */
export function createDatabase(url: string): { db: Database; pool: mysql.Pool } {
  const p = mysql.createPool({ uri: url, connectionLimit: 5, timezone: "Z" });
  return { db: drizzle(p, { schema, mode: "default" }), pool: p };
}
