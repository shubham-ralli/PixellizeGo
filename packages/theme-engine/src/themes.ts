import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rootDir } from "@pixellize/core";
import { type Database, type ThemeRow, themes } from "@pixellize/database";
import { eq } from "drizzle-orm";

export const THEMES_DIR = join(rootDir, "apps/frontend/src/themes");

export interface ThemeManifest {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  themeUri?: string;
}

/**
 * Read theme metadata from the WordPress-style header comment at the top of
 * themes/<slug>/style.css, e.g.:
 *
 *   /*
 *   Theme Name: Default
 *   Version: 1.0.0
 *   Description: ...
 *   Author: ...
 *   *\/
 */
export function readManifest(slug: string): ThemeManifest | undefined {
  const file = join(THEMES_DIR, slug, "style.css");
  if (!existsSync(file)) return undefined;
  const css = readFileSync(file, "utf8");
  const header = css.match(/\/\*([\s\S]*?)\*\//);
  if (!header?.[1]) return undefined;

  const fields: Record<string, string> = {};
  for (const line of header[1].split("\n")) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z ]+?)\s*:\s*(.+?)\s*$/);
    if (m?.[1] && m[2]) fields[m[1].toLowerCase()] = m[2];
  }

  const name = fields["theme name"];
  if (!name) return undefined; // not a theme stylesheet header
  return {
    slug,
    name,
    version: fields.version || "1.0.0",
    description: fields.description,
    author: fields.author,
    themeUri: fields["theme uri"],
  };
}

/** Register/refresh a theme row from its manifest (idempotent). */
export async function registerTheme(db: Database, slug: string): Promise<void> {
  const manifest = readManifest(slug);
  if (!manifest) throw new Error(`Theme manifest not found for "${slug}"`);
  await db
    .insert(themes)
    .values({
      slug: manifest.slug,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
    })
    .onDuplicateKeyUpdate({
      set: { name: manifest.name, version: manifest.version, description: manifest.description },
    });
}

export async function listThemes(db: Database): Promise<ThemeRow[]> {
  return db.select().from(themes).orderBy(themes.name);
}

export async function getActiveTheme(db: Database): Promise<ThemeRow | undefined> {
  const active = (await db.select().from(themes).where(eq(themes.isActive, true)).limit(1))[0];
  if (active) return active;
  // Fallback: first theme, or undefined.
  return (await db.select().from(themes).limit(1))[0];
}

export async function activateTheme(db: Database, slug: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(themes).set({ isActive: false });
    const res = await tx.update(themes).set({ isActive: true }).where(eq(themes.slug, slug));
    const [header] = res as unknown as [{ affectedRows: number }];
    if (!header.affectedRows) throw new Error(`Theme "${slug}" not found`);
  });
}

export async function setThemeSettings(
  db: Database,
  slug: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await db.update(themes).set({ settings }).where(eq(themes.slug, slug));
}
