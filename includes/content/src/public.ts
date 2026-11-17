import {
  type Database,
  media,
  postTerms,
  postTypes,
  posts,
  taxonomies,
  terms,
  users,
} from "@pixellize/database";
import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
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

/**
 * Resolve a published page by its full nested path (e.g. "/demo/page-1"), matching
 * the canonical path exactly so only the right ancestor chain resolves. The last
 * segment is the page's own slug (unique per type).
 */
export async function getPublishedByPath(db: Database, pathStr: string): Promise<PostDTO | undefined> {
  const segments = pathStr.split("/").filter(Boolean);
  if (segments.length === 0) return undefined;
  const last = segments[segments.length - 1]!;
  const canonical = `/${segments.join("/")}`;
  const rows = await db
    .select({ id: posts.id, status: posts.status })
    .from(posts)
    .where(and(eq(posts.slug, last), isNull(posts.deletedAt)));
  for (const r of rows) {
    if (r.status !== "published") continue;
    const dto = await getPost(db, r.id);
    if (dto && dto.path === canonical) return dto;
  }
  return undefined;
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

/** Full-text-ish search over published "post"-type content (title, excerpt, content). */
export async function searchPublished(
  db: Database,
  query: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: PublicListItem[]; total: number }> {
  const q = query.trim();
  if (!q) return { items: [], total: 0 };
  const limit = Math.min(opts.limit ?? 20, 50);
  const offset = opts.offset ?? 0;
  const like$ = `%${q}%`;
  const where = and(
    eq(posts.type, "post"),
    eq(posts.status, "published"),
    isNull(posts.deletedAt),
    or(like(posts.title, like$), like(posts.excerpt, like$), like(posts.content, like$)),
  );

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

/** Published posts in a term, resolved by the taxonomy's public route (e.g. "category", "tag"). */
export async function listPublishedByTerm(
  db: Database,
  taxonomyRoute: string,
  termSlug: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<
  { items: PublicListItem[]; total: number; term: { name: string; slug: string }; taxonomyLabel: string } | undefined
> {
  const limit = Math.min(opts.limit ?? 10, 50);
  const offset = opts.offset ?? 0;

  const tx = (await db.select().from(taxonomies).where(eq(taxonomies.route, taxonomyRoute)).limit(1))[0];
  if (!tx) return undefined;
  const term = (
    await db.select().from(terms).where(and(eq(terms.taxonomyId, tx.id), eq(terms.slug, termSlug))).limit(1)
  )[0];
  if (!term) return undefined;

  const where = and(eq(postTerms.termId, term.id), eq(posts.status, "published"), isNull(posts.deletedAt));
  const rows = await db
    .select(listCols)
    .from(posts)
    .innerJoin(postTerms, eq(postTerms.postId, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(media, eq(posts.featuredMediaId, media.id))
    .where(where)
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset);

  const total = (
    await db.select({ id: posts.id }).from(posts).innerJoin(postTerms, eq(postTerms.postId, posts.id)).where(where)
  ).length;
  return {
    items: rows.map(toListItem),
    total,
    term: { name: term.name, slug: term.slug },
    taxonomyLabel: tx.label,
  };
}

/** Published content for the sitemap (paginated for large sites), with each type's route prefix. */
export async function listPublishedForSitemap(
  db: Database,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ route: string; slug: string; updatedAt: string }[]> {
  const where = and(eq(posts.status, "published"), isNull(posts.deletedAt));
  let q = db
    .select({ route: postTypes.route, slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .leftJoin(postTypes, eq(posts.type, postTypes.slug))
    .where(where)
    .orderBy(posts.id)
    .$dynamic();
  if (opts.limit != null) q = q.limit(opts.limit).offset(opts.offset ?? 0);
  const rows = await q;
  return rows.map((r) => ({ route: r.route ?? "", slug: r.slug, updatedAt: r.updatedAt.toISOString() }));
}

/** A single published post/page by id (returns full DTO), or undefined. */
export async function getPublishedById(db: Database, id: number): Promise<PostDTO | undefined> {
  const row = (
    await db.select({ status: posts.status, deletedAt: posts.deletedAt }).from(posts).where(eq(posts.id, id)).limit(1)
  )[0];
  if (!row || row.status !== "published" || row.deletedAt) return undefined;
  return getPost(db, id);
}

/** Latest published posts with content, for the RSS feed. */
export async function listPublishedForFeed(
  db: Database,
  limit: number,
): Promise<{ title: string; slug: string; excerpt: string | null; content: string | null; authorName: string | null; publishedAt: string | null }[]> {
  const rows = await db
    .select({
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      content: posts.content,
      authorName: users.name,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.type, "post"), eq(posts.status, "published"), isNull(posts.deletedAt)))
    .orderBy(desc(posts.publishedAt))
    .limit(Math.min(limit, 50));
  return rows.map((r) => ({ ...r, publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null }));
}

/** Count of published content (for building the sitemap index). */
export async function countPublishedForSitemap(db: Database): Promise<number> {
  const row = (
    await db
      .select({ c: sql<number>`count(*)` })
      .from(posts)
      .where(and(eq(posts.status, "published"), isNull(posts.deletedAt)))
  )[0];
  return Number(row?.c ?? 0);
}
