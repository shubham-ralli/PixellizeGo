import { slugify } from "@pixellize/core";
import {
  type Database,
  categories,
  media,
  postCategories,
  postMeta,
  postTags,
  posts,
  revisions,
  tags,
  users,
} from "@pixellize/database";
import { and, desc, eq, inArray, isNotNull, isNull, like, lte, ne } from "drizzle-orm";

export type PostType = "post" | "page";
export type PostStatus = "draft" | "published" | "scheduled";

export class ContentError extends Error {
  code: "NOT_FOUND" | "INVALID_SCHEDULE";
  constructor(code: ContentError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "ContentError";
  }
}

export interface PostInput {
  type?: PostType;
  title: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  status?: PostStatus;
  scheduledAt?: string | null; // ISO
  featuredMediaId?: number | null;
  categoryIds?: number[];
  tagIds?: number[];
  meta?: Record<string, string>;
}

export interface PostDTO {
  id: number;
  type: PostType;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  status: PostStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  featuredMedia: { id: number; url: string; altText: string | null } | null;
  author: { id: number; name: string } | null;
  categories: { id: number; name: string; slug: string }[];
  tags: { id: number; name: string; slug: string }[];
  meta: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

async function uniqueSlug(db: Database, type: PostType, base: string, excludeId?: number): Promise<string> {
  const root = slugify(base) || "untitled";
  for (let n = 0; n < 1000; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const clash = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        excludeId
          ? and(eq(posts.type, type), eq(posts.slug, candidate), ne(posts.id, excludeId))
          : and(eq(posts.type, type), eq(posts.slug, candidate)),
      )
      .limit(1);
    if (clash.length === 0) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** Resolve status + the two timestamp columns from requested status. */
function resolveStatus(
  status: PostStatus,
  scheduledAt: string | null | undefined,
  currentPublishedAt: Date | null,
): { status: PostStatus; publishedAt: Date | null; scheduledAt: Date | null } {
  if (status === "published") {
    return { status, publishedAt: currentPublishedAt ?? new Date(), scheduledAt: null };
  }
  if (status === "scheduled") {
    const when = scheduledAt ? new Date(scheduledAt) : null;
    if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw new ContentError("INVALID_SCHEDULE", "scheduledAt must be a future date/time.");
    }
    return { status, publishedAt: null, scheduledAt: when };
  }
  return { status: "draft", publishedAt: null, scheduledAt: null };
}

async function replaceMeta(db: Database, postId: number, meta: Record<string, string>): Promise<void> {
  await db.delete(postMeta).where(eq(postMeta.postId, postId));
  const rows = Object.entries(meta)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([metaKey, metaValue]) => ({ postId, metaKey, metaValue }));
  if (rows.length) await db.insert(postMeta).values(rows);
}

async function replaceTaxonomy(
  db: Database,
  postId: number,
  categoryIds: number[] | undefined,
  tagIds: number[] | undefined,
): Promise<void> {
  if (categoryIds) {
    await db.delete(postCategories).where(eq(postCategories.postId, postId));
    if (categoryIds.length)
      await db.insert(postCategories).values(categoryIds.map((categoryId) => ({ postId, categoryId })));
  }
  if (tagIds) {
    await db.delete(postTags).where(eq(postTags.postId, postId));
    if (tagIds.length) await db.insert(postTags).values(tagIds.map((tagId) => ({ postId, tagId })));
  }
}

export async function createPost(db: Database, authorId: number, input: PostInput): Promise<PostDTO> {
  const type = input.type ?? "post";
  const slug = await uniqueSlug(db, type, input.slug || input.title);
  const st = resolveStatus(input.status ?? "draft", input.scheduledAt, null);

  const id = await db.transaction(async (tx) => {
    const result = await tx.insert(posts).values({
      type,
      title: input.title,
      slug,
      excerpt: input.excerpt ?? null,
      content: input.content ?? null,
      status: st.status,
      publishedAt: st.publishedAt,
      scheduledAt: st.scheduledAt,
      featuredMediaId: input.featuredMediaId ?? null,
      authorId,
    });
    const [header] = result as unknown as [{ insertId: number }];
    const postId = Number(header.insertId);
    await replaceTaxonomy(tx, postId, input.categoryIds, input.tagIds);
    if (input.meta) await replaceMeta(tx, postId, input.meta);
    await tx.insert(revisions).values({
      postId,
      title: input.title,
      content: input.content ?? null,
      kind: "manual",
      authorId,
    });
    return postId;
  });

  const dto = await getPost(db, id);
  if (!dto) throw new ContentError("NOT_FOUND", "Post vanished after insert");
  return dto;
}

export async function updatePost(
  db: Database,
  id: number,
  authorId: number,
  input: PostInput,
): Promise<PostDTO> {
  const existing = (await db.select().from(posts).where(eq(posts.id, id)).limit(1))[0];
  if (!existing) throw new ContentError("NOT_FOUND", "Post not found");

  const type = input.type ?? (existing.type as PostType);
  const slug =
    input.slug !== undefined || input.title !== existing.title
      ? await uniqueSlug(db, type, input.slug || input.title, id)
      : existing.slug;
  const st = resolveStatus(input.status ?? (existing.status as PostStatus), input.scheduledAt, existing.publishedAt);

  await db.transaction(async (tx) => {
    await tx
      .update(posts)
      .set({
        type,
        title: input.title,
        slug,
        excerpt: input.excerpt ?? null,
        content: input.content ?? null,
        status: st.status,
        publishedAt: st.publishedAt,
        scheduledAt: st.scheduledAt,
        featuredMediaId: input.featuredMediaId ?? null,
      })
      .where(eq(posts.id, id));
    await replaceTaxonomy(tx, id, input.categoryIds, input.tagIds);
    if (input.meta) await replaceMeta(tx, id, input.meta);
    await tx.insert(revisions).values({
      postId: id,
      title: input.title,
      content: input.content ?? null,
      kind: "manual",
      authorId,
    });
  });

  const dto = await getPost(db, id);
  if (!dto) throw new ContentError("NOT_FOUND", "Post not found after update");
  return dto;
}

/** Lightweight autosave: updates draft content + stores an autosave revision. */
export async function autosavePost(
  db: Database,
  id: number,
  authorId: number,
  patch: { title?: string; content?: string | null },
): Promise<{ savedAt: string }> {
  const existing = (await db.select().from(posts).where(eq(posts.id, id)).limit(1))[0];
  if (!existing) throw new ContentError("NOT_FOUND", "Post not found");
  await db.transaction(async (tx) => {
    await tx
      .update(posts)
      .set({ title: patch.title ?? existing.title, content: patch.content ?? existing.content })
      .where(eq(posts.id, id));
    await tx.insert(revisions).values({
      postId: id,
      title: patch.title ?? existing.title,
      content: patch.content ?? existing.content,
      kind: "autosave",
      authorId,
    });
  });
  return { savedAt: new Date().toISOString() };
}

/** Soft delete: move to trash. */
export async function trashPost(db: Database, id: number): Promise<void> {
  const res = await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new ContentError("NOT_FOUND", "Post not found");
}

/** Restore from trash. */
export async function restorePost(db: Database, id: number): Promise<void> {
  const res = await db.update(posts).set({ deletedAt: null }).where(eq(posts.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new ContentError("NOT_FOUND", "Post not found");
}

/** Permanently delete (only from trash in the UI, but works regardless). */
export async function forceDeletePost(db: Database, id: number): Promise<void> {
  const res = await db.delete(posts).where(eq(posts.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new ContentError("NOT_FOUND", "Post not found");
}

export async function bulkContent(
  db: Database,
  action: "trash" | "restore" | "delete",
  ids: number[],
): Promise<number> {
  if (ids.length === 0) return 0;
  if (action === "delete") {
    const res = await db.delete(posts).where(inArray(posts.id, ids));
    return Number((res as unknown as [{ affectedRows: number }])[0].affectedRows ?? 0);
  }
  const res = await db
    .update(posts)
    .set({ deletedAt: action === "trash" ? new Date() : null })
    .where(inArray(posts.id, ids));
  return Number((res as unknown as [{ affectedRows: number }])[0].affectedRows ?? 0);
}

export interface ListFilter {
  type?: PostType;
  status?: PostStatus;
  search?: string;
  trashed?: boolean; // true = only trashed, false/undefined = only active
  limit?: number;
  offset?: number;
}

export interface PostListItem {
  id: number;
  type: PostType;
  title: string;
  slug: string;
  status: PostStatus;
  authorName: string | null;
  featuredUrl: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}

export async function listPosts(
  db: Database,
  filter: ListFilter = {},
): Promise<{ items: PostListItem[]; total: number }> {
  const conds = [filter.trashed ? isNotNull(posts.deletedAt) : isNull(posts.deletedAt)];
  if (filter.type) conds.push(eq(posts.type, filter.type));
  if (filter.status) conds.push(eq(posts.status, filter.status));
  if (filter.search) conds.push(like(posts.title, `%${filter.search}%`));
  const where = and(...conds);

  const limit = Math.min(filter.limit ?? 20, 100);
  const offset = filter.offset ?? 0;

  const rows = await db
    .select({
      id: posts.id,
      type: posts.type,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      authorName: users.name,
      featuredUrl: media.url,
      publishedAt: posts.publishedAt,
      scheduledAt: posts.scheduledAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(media, eq(posts.featuredMediaId, media.id))
    .where(where)
    .orderBy(desc(posts.updatedAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db.select({ id: posts.id }).from(posts).where(where);

  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type as PostType,
      title: r.title,
      slug: r.slug,
      status: r.status as PostStatus,
      authorName: r.authorName,
      featuredUrl: r.featuredUrl,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: countRows.length,
  };
}

export async function getPost(db: Database, id: number): Promise<PostDTO | undefined> {
  const row = (
    await db
      .select({
        id: posts.id,
        type: posts.type,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        content: posts.content,
        status: posts.status,
        publishedAt: posts.publishedAt,
        scheduledAt: posts.scheduledAt,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        authorId: users.id,
        authorName: users.name,
        mediaId: media.id,
        mediaUrl: media.url,
        mediaAlt: media.altText,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .leftJoin(media, eq(posts.featuredMediaId, media.id))
      .where(eq(posts.id, id))
      .limit(1)
  )[0];
  if (!row) return undefined;

  const cats = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(postCategories)
    .innerJoin(categories, eq(postCategories.categoryId, categories.id))
    .where(eq(postCategories.postId, id));

  const tagRows = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, id));

  const metaRows = await db
    .select({ metaKey: postMeta.metaKey, metaValue: postMeta.metaValue })
    .from(postMeta)
    .where(eq(postMeta.postId, id));
  const meta: Record<string, string> = {};
  for (const m of metaRows) meta[m.metaKey] = m.metaValue ?? "";

  return {
    id: row.id,
    type: row.type as PostType,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    status: row.status as PostStatus,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    featuredMedia: row.mediaId ? { id: row.mediaId, url: row.mediaUrl!, altText: row.mediaAlt } : null,
    author: row.authorId ? { id: row.authorId, name: row.authorName! } : null,
    categories: cats,
    tags: tagRows,
    meta,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRevisions(db: Database, postId: number) {
  const rows = await db
    .select({
      id: revisions.id,
      title: revisions.title,
      kind: revisions.kind,
      authorId: revisions.authorId,
      createdAt: revisions.createdAt,
    })
    .from(revisions)
    .where(eq(revisions.postId, postId))
    .orderBy(desc(revisions.createdAt))
    .limit(50);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Flip due scheduled posts to published. Call from a cron-hit endpoint. */
export async function publishDueScheduled(db: Database, now = new Date()): Promise<number> {
  const res = await db
    .update(posts)
    .set({ status: "published", publishedAt: now, scheduledAt: null })
    .where(and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, now), isNull(posts.deletedAt)));
  const [header] = res as unknown as [{ affectedRows: number }];
  return Number(header.affectedRows ?? 0);
}
