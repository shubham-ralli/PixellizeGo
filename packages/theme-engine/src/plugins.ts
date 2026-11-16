import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rootDir } from "@pixellize/core";
import { type Database, type PluginRow, plugins } from "@pixellize/database";
import { eq } from "drizzle-orm";

export const PLUGINS_DIR = join(rootDir, "plugins");

export interface PluginManifest {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

export class PluginError extends Error {
  constructor(
    public code: "NO_HEADER" | "NOT_FOUND" | "BAD_ZIP",
    message: string,
  ) {
    super(message);
  }
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.(zip|php|js)$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "plugin";

/**
 * Parse a WordPress-style plugin header comment, e.g.:
 *
 *   /*
 *   Plugin Name: Hello
 *   Version: 1.0.0
 *   Description: ...
 *   Author: ...
 *   *\/
 *
 * Returns undefined if the text has no "Plugin Name:" field.
 */
function parseHeader(slug: string, text: string): PluginManifest | undefined {
  const block = text.match(/\/\*([\s\S]*?)\*\//);
  if (!block?.[1]) return undefined;
  const fields: Record<string, string> = {};
  for (const line of block[1].split("\n")) {
    const m = line.match(/^\s*\*?\s*([A-Za-z][A-Za-z ]+?)\s*:\s*(.+?)\s*$/);
    if (m?.[1] && m[2]) fields[m[1].toLowerCase()] = m[2];
  }
  const name = fields["plugin name"];
  if (!name) return undefined;
  return {
    slug,
    name,
    version: fields.version || "1.0.0",
    description: fields.description,
    author: fields.author,
  };
}

/** Find a plugin header among the top-level .php/.js files of a folder. */
function readManifestFromDir(dir: string, slug: string): PluginManifest | undefined {
  for (const f of readdirSync(dir)) {
    if (!/\.(php|js)$/i.test(f)) continue;
    const m = parseHeader(slug, readFileSync(join(dir, f), "utf8"));
    if (m) return m;
  }
  return undefined;
}

/** Upsert a plugin row from its manifest. Preserves the is_active flag. */
async function register(db: Database, m: PluginManifest): Promise<void> {
  await db
    .insert(plugins)
    .values({ slug: m.slug, name: m.name, version: m.version, description: m.description, author: m.author })
    .onDuplicateKeyUpdate({
      set: { name: m.name, version: m.version, description: m.description, author: m.author },
    });
}

/** Register any plugin folders on disk that aren't in the DB yet (idempotent). */
export async function syncPlugins(db: Database): Promise<void> {
  if (!existsSync(PLUGINS_DIR)) return;
  for (const entry of readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const m = readManifestFromDir(join(PLUGINS_DIR, entry.name), entry.name);
    if (m) await register(db, m);
  }
}

export async function listPlugins(db: Database): Promise<PluginRow[]> {
  await syncPlugins(db);
  return db.select().from(plugins).orderBy(plugins.name);
}

export async function setPluginActive(db: Database, slug: string, active: boolean): Promise<void> {
  const res = await db.update(plugins).set({ isActive: active }).where(eq(plugins.slug, slug));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new PluginError("NOT_FOUND", `Plugin "${slug}" not found`);
}

export async function deletePlugin(db: Database, slug: string): Promise<void> {
  await db.delete(plugins).where(eq(plugins.slug, slug));
  const dir = join(PLUGINS_DIR, slug);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

/**
 * Install a plugin from an uploaded .zip: extract, locate the plugin folder
 * and its header, move it into PLUGINS_DIR, and register the row.
 * ponytail: shells out to the `unzip` CLI; swap for a zip lib if a host lacks it.
 */
export async function installPluginFromZip(
  db: Database,
  zip: Buffer,
  originalName: string,
): Promise<PluginRow> {
  const work = mkdtempSync(join(tmpdir(), "pcms-plugin-"));
  try {
    const zipPath = join(work, "upload.zip");
    const extractDir = join(work, "extract");
    mkdirSync(extractDir);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(zipPath, zip);
    try {
      execFileSync("unzip", ["-qq", "-o", zipPath, "-d", extractDir]);
    } catch {
      throw new PluginError("BAD_ZIP", "Could not read the uploaded .zip file.");
    }

    // A WP plugin zip usually wraps everything in a single top-level folder;
    // some are flat. Resolve the real source folder either way.
    const top = readdirSync(extractDir, { withFileTypes: true }).filter((e) => e.name !== "__MACOSX");
    const dirs = top.filter((e) => e.isDirectory());
    let srcDir = extractDir;
    let slug = slugify(originalName);
    if (dirs.length === 1 && top.length === 1 && dirs[0]) {
      srcDir = join(extractDir, dirs[0].name);
      slug = slugify(dirs[0].name);
    }

    const manifest = readManifestFromDir(srcDir, slug);
    if (!manifest) {
      throw new PluginError(
        "NO_HEADER",
        "No plugin header found. The main .php or .js file needs a /* Plugin Name: ... */ comment.",
      );
    }

    const dest = join(PLUGINS_DIR, manifest.slug);
    mkdirSync(PLUGINS_DIR, { recursive: true });
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    cpSync(srcDir, dest, { recursive: true });

    await register(db, manifest);
    const row = (await db.select().from(plugins).where(eq(plugins.slug, manifest.slug)).limit(1))[0];
    if (!row) throw new PluginError("NOT_FOUND", "Plugin row missing after install.");
    return row;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
