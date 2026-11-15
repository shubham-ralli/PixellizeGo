import { type Database, settings } from "@pixellize/database";
import { inArray } from "drizzle-orm";

export const SITE_SETTING_KEYS = ["siteTitle", "tagline", "siteUrl", "postsPerPage", "adminEmail"] as const;

export const SEO_SETTING_KEYS = [
  "seoMetaDescription",
  "seoTitleSeparator",
  "seoNoindex",
  "seoDefaultOgImage",
] as const;

export async function getSettings(db: Database): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value ?? "";
  return out;
}

export async function getSettingsFor(db: Database, keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value ?? "";
  return out;
}

export async function setSettings(db: Database, values: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onDuplicateKeyUpdate({ set: { value } });
  }
}
