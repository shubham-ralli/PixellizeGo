import { env } from "@pixellize/core/env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: env.DATABASE_URL },
  casing: "snake_case",
});
