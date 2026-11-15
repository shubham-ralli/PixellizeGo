import { slugify } from "@pixellize/core";
import { type Database, type PostTypeRow, postTypes, posts } from "@pixellize/database";
import { eq, sql } from "drizzle-orm";

export class PostTypeError extends Error {
  code: "NOT_FOUND" | "CONFLICT";
  constructor(code: PostTypeError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "PostTypeError";
  }
}

export async function listPostTypes(db: Database): Promise<(PostTypeRow & { postCount: number })[]> {
  const rows = await db
    .select({
      id: postTypes.id,
      slug: postTypes.slug,
      label: postTypes.label,
      labelPlural: postTypes.labelPlural,
      route: postTypes.route,
      hierarchical: postTypes.hierarchical,
      hasArchive: postTypes.hasArchive,
      builtIn: postTypes.builtIn,
      createdAt: postTypes.createdAt,
      postCount: sql<number>`count(${posts.id})`,
    })
    .from(postTypes)
    .leftJoin(posts, eq(posts.type, postTypes.slug))
    .groupBy(postTypes.id)
    .orderBy(postTypes.id);
  return rows.map((r) => ({ ...r, postCount: Number(r.postCount) }));
}

export async function getPostType(db: Database, slug: string): Promise<PostTypeRow | undefined> {
  return (await db.select().from(postTypes).where(eq(postTypes.slug, slug)).limit(1))[0];
}

export async function getPostTypeByRoute(db: Database, route: string): Promise<PostTypeRow | undefined> {
  return (await db.select().from(postTypes).where(eq(postTypes.route, route)).limit(1))[0];
}

async function uniqueSlug(db: Database, base: string, excludeId?: number): Promise<string> {
  const root = slugify(base) || "type";
  for (let n = 0; n < 1000; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const clash = await db
      .select({ id: postTypes.id })
      .from(postTypes)
      .where(excludeId ? sql`${postTypes.slug} = ${candidate} and ${postTypes.id} <> ${excludeId}` : eq(postTypes.slug, candidate))
      .limit(1);
    if (clash.length === 0) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export interface PostTypeInput {
  slug?: string;
  label: string;
  labelPlural: string;
  route?: string;
  hasArchive?: boolean;
}

export async function createPostType(db: Database, input: PostTypeInput): Promise<PostTypeRow> {
  const slug = await uniqueSlug(db, input.slug || input.label);
  const res = await db.insert(postTypes).values({
    slug,
    label: input.label,
    labelPlural: input.labelPlural,
    route: input.route ?? slug,
    hasArchive: input.hasArchive ?? false,
    builtIn: false,
  });
  const [header] = res as unknown as [{ insertId: number }];
  return (await db.select().from(postTypes).where(eq(postTypes.id, Number(header.insertId))).limit(1))[0]!;
}

export async function updatePostType(db: Database, id: number, input: PostTypeInput): Promise<PostTypeRow> {
  const existing = (await db.select().from(postTypes).where(eq(postTypes.id, id)).limit(1))[0];
  if (!existing) throw new PostTypeError("NOT_FOUND", "Post type not found");
  // slug is the stable identifier posts reference — only rename it for non-built-in types with no slug change requested.
  await db
    .update(postTypes)
    .set({
      label: input.label,
      labelPlural: input.labelPlural,
      route: input.route ?? existing.route,
      hasArchive: input.hasArchive ?? existing.hasArchive,
    })
    .where(eq(postTypes.id, id));
  return (await db.select().from(postTypes).where(eq(postTypes.id, id)).limit(1))[0]!;
}

export async function deletePostType(db: Database, id: number): Promise<void> {
  const existing = (await db.select().from(postTypes).where(eq(postTypes.id, id)).limit(1))[0];
  if (!existing) throw new PostTypeError("NOT_FOUND", "Post type not found");
  if (existing.builtIn) throw new PostTypeError("CONFLICT", "Built-in post types cannot be deleted");
  const used = await db.select({ id: posts.id }).from(posts).where(eq(posts.type, existing.slug)).limit(1);
  if (used.length > 0) throw new PostTypeError("CONFLICT", "Cannot delete a post type that still has content");
  await db.delete(postTypes).where(eq(postTypes.id, id));
}
