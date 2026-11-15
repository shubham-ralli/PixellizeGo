import {
  type Database,
  categories,
  media,
  postCategories,
  postTags,
  posts,
  tags,
  users,
} from "@pixellize/database";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getPost, type PostDTO, type PostType } from "./posts.js";

export interface PublicListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredUrl: string | null;
  authorName: string | null;
  publishedAt: string | null;
}

function toListItem(r: {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredUrl: string | null;
  authorName: string | null;
  publishedAt: Date | null;
}): PublicListItem {
  return { ...r, publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null };
}

const listCols = {
  id: posts.id,
  title: posts.title,
  slug: posts.slug,
  excerpt: posts.excerpt,
  featuredUrl: media.url,
  authorName: users.name,
  publishedAt: posts.publishedAt,
};

/** A single published post/page by slug (returns full DTO), or undefined. */
export async function getPublishedBySlug(
  db: Database,
  type: PostType,
  slug: string,
): Promise<PostDTO | undefined> {
  const row = (
    await db
      .select({ id: posts.id, status: posts.status })
      .from(posts)
      .where(and(eq(posts.type, type), eq(posts.slug, slug), isNull(posts.deletedAt)))
      .limit(1)
  )[0];
  if (!row || row.status !== "published") return undefined;
  return getPost(db, row.id);
}

export async function listPublishedPosts(
  db: Database,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: PublicListItem[]; total: number }> {
  const limit = Math.min(opts.limit ?? 10, 50);
  const offset = opts.offset ?? 0;
  const where = and(eq(posts.type, "post"), eq(posts.status, "published"), isNull(posts.deletedAt));

  const rows = await db
    .select(listCols)
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(media, eq(posts.featuredMediaId, media.id))
    .where(where)
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset);

  const count = (await db.select({ id: posts.id }).from(posts).where(where)).length;
  return { items: rows.map(toListItem), total: count };
}

/** Published posts in a category or tag (by slug). */
export async function listPublishedByTaxonomy(
  db: Database,
  kind: "category" | "tag",
  slug: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: PublicListItem[]; total: number; term: { name: string; slug: string } } | undefined> {
  const limit = Math.min(opts.limit ?? 10, 50);
  const offset = opts.offset ?? 0;

  if (kind === "category") {
    const term = (await db.select().from(categories).where(eq(categories.slug, slug)).limit(1))[0];
    if (!term) return undefined;
    const rows = await db
      .select(listCols)
      .from(posts)
      .innerJoin(postCategories, eq(postCategories.postId, posts.id))
      .leftJoin(users, eq(posts.authorId, users.id))
      .leftJoin(media, eq(posts.featuredMediaId, media.id))
      .where(and(eq(postCategories.categoryId, term.id), eq(posts.status, "published"), isNull(posts.deletedAt)))
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .offset(offset);
    return { items: rows.map(toListItem), total: rows.length, term: { name: term.name, slug: term.slug } };
  }

  const term = (await db.select().from(tags).where(eq(tags.slug, slug)).limit(1))[0];
  if (!term) return undefined;
  const rows = await db
    .select(listCols)
    .from(posts)
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(media, eq(posts.featuredMediaId, media.id))
    .where(and(eq(postTags.tagId, term.id), eq(posts.status, "published"), isNull(posts.deletedAt)))
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset);
  return { items: rows.map(toListItem), total: rows.length, term: { name: term.name, slug: term.slug } };
}

/** All published post + page slugs for the sitemap. */
export async function listPublishedForSitemap(
  db: Database,
): Promise<{ type: PostType; slug: string; updatedAt: string }[]> {
  const rows = await db
    .select({ type: posts.type, slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(and(eq(posts.status, "published"), isNull(posts.deletedAt)));
  return rows.map((r) => ({ type: r.type as PostType, slug: r.slug, updatedAt: r.updatedAt.toISOString() }));
}
