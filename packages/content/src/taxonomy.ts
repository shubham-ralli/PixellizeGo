import { slugify } from "@pixellize/core";
import {
  type CategoryRow,
  type Database,
  type TagRow,
  categories,
  postCategories,
  postTags,
  tags,
} from "@pixellize/database";
import { and, eq, ne, sql } from "drizzle-orm";

export class TaxonomyError extends Error {
  code: "NOT_FOUND";
  constructor(message: string) {
    super(message);
    this.code = "NOT_FOUND";
    this.name = "TaxonomyError";
  }
}

async function uniqueSlug(
  db: Database,
  table: typeof categories | typeof tags,
  base: string,
  excludeId?: number,
): Promise<string> {
  const root = slugify(base) || "item";
  for (let n = 0; n < 1000; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const clash = await db
      .select({ id: table.id })
      .from(table)
      .where(excludeId ? and(eq(table.slug, candidate), ne(table.id, excludeId)) : eq(table.slug, candidate))
      .limit(1);
    if (clash.length === 0) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/* -------- categories -------- */

export async function listCategories(db: Database): Promise<(CategoryRow & { postCount: number })[]> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      parentId: categories.parentId,
      createdAt: categories.createdAt,
      postCount: sql<number>`count(${postCategories.postId})`,
    })
    .from(categories)
    .leftJoin(postCategories, eq(postCategories.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(categories.name);
  return rows.map((r) => ({ ...r, postCount: Number(r.postCount) }));
}

export async function createCategory(
  db: Database,
  input: { name: string; description?: string | null; parentId?: number | null; slug?: string },
): Promise<CategoryRow> {
  const slug = await uniqueSlug(db, categories, input.slug || input.name);
  const res = await db.insert(categories).values({
    name: input.name,
    slug,
    description: input.description ?? null,
    parentId: input.parentId ?? null,
  });
  const [header] = res as unknown as [{ insertId: number }];
  return (await db.select().from(categories).where(eq(categories.id, Number(header.insertId))).limit(1))[0]!;
}

export async function updateCategory(
  db: Database,
  id: number,
  input: { name: string; description?: string | null; parentId?: number | null; slug?: string },
): Promise<CategoryRow> {
  const existing = (await db.select().from(categories).where(eq(categories.id, id)).limit(1))[0];
  if (!existing) throw new TaxonomyError("Category not found");
  const slug = input.slug
    ? await uniqueSlug(db, categories, input.slug, id)
    : input.name !== existing.name
      ? await uniqueSlug(db, categories, input.name, id)
      : existing.slug;
  await db
    .update(categories)
    .set({ name: input.name, slug, description: input.description ?? null, parentId: input.parentId ?? null })
    .where(eq(categories.id, id));
  return (await db.select().from(categories).where(eq(categories.id, id)).limit(1))[0]!;
}

export async function deleteCategory(db: Database, id: number): Promise<void> {
  const res = await db.delete(categories).where(eq(categories.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new TaxonomyError("Category not found");
}

/* -------- tags -------- */

export async function listTags(db: Database): Promise<(TagRow & { postCount: number })[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      createdAt: tags.createdAt,
      postCount: sql<number>`count(${postTags.postId})`,
    })
    .from(tags)
    .leftJoin(postTags, eq(postTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(tags.name);
  return rows.map((r) => ({ ...r, postCount: Number(r.postCount) }));
}

export async function createTag(db: Database, input: { name: string; slug?: string }): Promise<TagRow> {
  const slug = await uniqueSlug(db, tags, input.slug || input.name);
  const res = await db.insert(tags).values({ name: input.name, slug });
  const [header] = res as unknown as [{ insertId: number }];
  return (await db.select().from(tags).where(eq(tags.id, Number(header.insertId))).limit(1))[0]!;
}

export async function updateTag(
  db: Database,
  id: number,
  input: { name: string; slug?: string },
): Promise<TagRow> {
  const existing = (await db.select().from(tags).where(eq(tags.id, id)).limit(1))[0];
  if (!existing) throw new TaxonomyError("Tag not found");
  const slug = input.slug
    ? await uniqueSlug(db, tags, input.slug, id)
    : input.name !== existing.name
      ? await uniqueSlug(db, tags, input.name, id)
      : existing.slug;
  await db.update(tags).set({ name: input.name, slug }).where(eq(tags.id, id));
  return (await db.select().from(tags).where(eq(tags.id, id)).limit(1))[0]!;
}

export async function deleteTag(db: Database, id: number): Promise<void> {
  const res = await db.delete(tags).where(eq(tags.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new TaxonomyError("Tag not found");
}
