import { randomUUID } from "node:crypto";
import { type Database, media, type MediaRow } from "@pixellize/database";
import { dateKey, getStorage } from "@pixellize/storage";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import sharp from "sharp";

const THUMB_MAX = 400; // longest edge of the generated thumbnail

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
  let thumbnailPath: string | null = null;
  let thumbnailUrl: string | null = null;
  const isRaster = input.mimeType.startsWith("image/") && input.mimeType !== "image/svg+xml";

  const key = dateKey(`${randomUUID()}.${ext}`);
  const stored = await getStorage().save(key, input.buffer);

  if (isRaster) {
    try {
      const img = sharp(input.buffer);
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      // Only generate a thumbnail when the image is bigger than the thumb box.
      if ((width ?? 0) > THUMB_MAX || (height ?? 0) > THUMB_MAX) {
        const thumbBuf = await img
          .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer();
        const thumbKey = key.replace(/\.[^.]+$/, "") + "-thumb.webp";
        const thumbStored = await getStorage().save(thumbKey, thumbBuf);
        thumbnailPath = thumbStored.key;
        thumbnailUrl = thumbStored.url;
      }
    } catch {
      // Not a decodable image; store as-is without dimensions/thumbnail.
    }
  }

  const result = await db.insert(media).values({
    filename: key.split("/").pop()!,
    originalName: input.originalName.slice(0, 255),
    mimeType: input.mimeType,
    size: input.buffer.length,
    width,
    height,
    path: stored.key,
    url: stored.url,
    thumbnailPath,
    thumbnailUrl,
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
  opts: { limit?: number; offset?: number; type?: "image" | "document"; search?: string } = {},
): Promise<{ items: MediaRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;

  const conds = [];
  if (opts.type === "image") conds.push(like(media.mimeType, "image/%"));
  else if (opts.type === "document") conds.push(sql`${media.mimeType} not like 'image/%'`);
  if (opts.search) {
    const q = `%${opts.search}%`;
    conds.push(or(like(media.originalName, q), like(media.filename, q))!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const items = await db
    .select()
    .from(media)
    .where(where)
    .orderBy(desc(media.createdAt))
    .limit(limit)
    .offset(offset);
  const total = Number((await db.select({ c: sql<number>`count(*)` }).from(media).where(where))[0]?.c ?? 0);
  return { items, total };
}

export async function updateMediaAlt(db: Database, id: number, altText: string): Promise<void> {
  await db.update(media).set({ altText: altText.slice(0, 255) }).where(eq(media.id, id));
}

export async function deleteMedia(db: Database, id: number): Promise<void> {
  const row = await getMedia(db, id);
  if (!row) throw new MediaError("NOT_FOUND", "Media not found");
  await getStorage().delete(row.path);
  if (row.thumbnailPath) await getStorage().delete(row.thumbnailPath).catch(() => {});
  await db.delete(media).where(eq(media.id, id));
}
