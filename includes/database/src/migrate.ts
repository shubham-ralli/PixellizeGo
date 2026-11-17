import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { env } from "@pixellize/core/env";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main(): Promise<void> {
  const connection = await mysql.createConnection({ uri: env.DATABASE_URL, multipleStatements: true });
  const db = drizzle(connection);
  console.log(`Running migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
  await connection.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
