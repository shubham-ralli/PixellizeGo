import { randomUUID } from "node:crypto";
import { type Database, media, type MediaRow } from "@pixellize/database";
import { dateKey, getStorage } from "@pixellize/storage";
import { desc, eq, sql } from "drizzle-orm";
import sharp from "sharp";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

export const ALLOWED_MIME = Object.keys(EXT_BY_MIME);

export class MediaError extends Error {
  code: "UNSUPPORTED_TYPE" | "NOT_FOUND";
  constructor(code: MediaError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "MediaError";
  }
}

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  uploadedById?: number;
  altText?: string;
}

export async function createMedia(db: Database, input: UploadInput): Promise<MediaRow> {
  const ext = EXT_BY_MIME[input.mimeType];
  if (!ext) {
    throw new MediaError("UNSUPPORTED_TYPE", `Unsupported file type: ${input.mimeType}`);
  }

  let width: number | null = null;
  let height: number | null = null;
  if (input.mimeType.startsWith("image/") && input.mimeType !== "image/svg+xml") {
    try {
      const meta = await sharp(input.buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      // Not a decodable image; store as-is without dimensions.
    }
  }

  const key = dateKey(`${randomUUID()}.${ext}`);
  const stored = await getStorage().save(key, input.buffer);

  const result = await db.insert(media).values({
    filename: key.split("/").pop()!,
    originalName: input.originalName.slice(0, 255),
    mimeType: input.mimeType,
    size: input.buffer.length,
    width,
    height,
    path: stored.key,
    url: stored.url,
    altText: input.altText?.slice(0, 255),
    uploadedById: input.uploadedById,
  });
  const [header] = result as unknown as [{ insertId: number }];
  const row = await getMedia(db, Number(header.insertId));
  if (!row) throw new MediaError("NOT_FOUND", "Media vanished after insert");
  return row;
}

export async function getMedia(db: Database, id: number): Promise<MediaRow | undefined> {
  return (await db.select().from(media).where(eq(media.id, id)).limit(1))[0];
}

export async function listMedia(
  db: Database,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: MediaRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const items = await db
    .select()
    .from(media)
    .orderBy(desc(media.createdAt))
    .limit(limit)
    .offset(offset);
  const total = Number((await db.select({ c: sql<number>`count(*)` }).from(media))[0]?.c ?? 0);
  return { items, total };
}

export async function updateMediaAlt(db: Database, id: number, altText: string): Promise<void> {
  await db.update(media).set({ altText: altText.slice(0, 255) }).where(eq(media.id, id));
}

export async function deleteMedia(db: Database, id: number): Promise<void> {
  const row = await getMedia(db, id);
  if (!row) throw new MediaError("NOT_FOUND", "Media not found");
  await getStorage().delete(row.path);
  await db.delete(media).where(eq(media.id, id));
}
