import { mkdir, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { env, rootDir } from "@pixellize/core";

export interface StoredObject {
  /** Key relative to the storage root, e.g. "2026/11/abc.png". */
  key: string;
  /** Absolute filesystem path (local adapter only). */
  path: string;
  /** Public URL for serving, e.g. "/uploads/2026/11/abc.png". */
  url: string;
}

/** Storage backend. Swap LocalStorage for an S3 adapter later without touching callers. */
export interface StorageAdapter {
  save(key: string, data: Buffer): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  /** Absolute root dir to serve statically (local adapter). */
  readonly root: string;
  readonly publicPath: string;
}

export class LocalStorage implements StorageAdapter {
  readonly root: string;
  readonly publicPath: string;

  constructor(uploadsDir = env.UPLOADS_DIR, publicPath = env.PUBLIC_UPLOADS_PATH) {
    this.root = isAbsolute(uploadsDir) ? uploadsDir : join(rootDir, uploadsDir);
    this.publicPath = publicPath;
  }

  async save(key: string, data: Buffer): Promise<StoredObject> {
    const path = join(this.root, key);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, data);
    return { key, path, url: `${this.publicPath}/${key}` };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.root, key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}

/** Build a date-partitioned key: "2026/11/<name>". */
export function dateKey(filename: string, now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}/${mm}/${filename}`;
}

let singleton: StorageAdapter | undefined;
export function getStorage(): StorageAdapter {
  if (!singleton) singleton = new LocalStorage();
  return singleton;
}
