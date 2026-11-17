import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

/** Walk up from cwd to find the monorepo root `.env` so any workspace cwd works. */
function findEnvFile(): string | undefined {
  let dir = process.cwd();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const envFile = findEnvFile();
loadDotenv({ path: envFile });

/** Monorepo root (directory containing .env), used to resolve storage paths. */
export const rootDir = envFile ? dirname(envFile) : process.cwd();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
  SESSION_COOKIE_NAME: z.string().default("pcms_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Media storage (local filesystem adapter).
  UPLOADS_DIR: z.string().default("content/uploads"), // relative to repo root, or absolute
  PUBLIC_UPLOADS_PATH: z.string().default("/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),

  // Shared secret for the cron-triggered scheduled-publish endpoint.
  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env: Env = parsed.data;
export const isProd = env.NODE_ENV === "production";
