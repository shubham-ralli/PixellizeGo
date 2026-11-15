import { slugify } from "@pixellize/core";
import {
  type Database,
  type TaxonomyRow,
  type TermRow,
  postTerms,
  taxonomies,
  terms,
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

export async function listTaxonomies(db: Database): Promise<TaxonomyRow[]> {
  return db.select().from(taxonomies).orderBy(taxonomies.id);
}

export async function getTaxonomyBySlug(db: Database, slug: string): Promise<TaxonomyRow | undefined> {
  return (await db.select().from(taxonomies).where(eq(taxonomies.slug, slug)).limit(1))[0];
}

export async function getTaxonomyByRoute(db: Database, route: string): Promise<TaxonomyRow | undefined> {
  return (await db.select().from(taxonomies).where(eq(taxonomies.route, route)).limit(1))[0];
}

async function requireTaxonomy(db: Database, slug: string): Promise<TaxonomyRow> {
  const tx = await getTaxonomyBySlug(db, slug);
  if (!tx) throw new TaxonomyError(`Taxonomy "${slug}" not found`);
  return tx;
}

async function uniqueSlug(db: Database, taxonomyId: number, base: string, excludeId?: number): Promise<string> {
  const root = slugify(base) || "term";
  for (let n = 0; n < 1000; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const clash = await db
      .select({ id: terms.id })
      .from(terms)
      .where(
        excludeId
          ? and(eq(terms.taxonomyId, taxonomyId), eq(terms.slug, candidate), ne(terms.id, excludeId))
          : and(eq(terms.taxonomyId, taxonomyId), eq(terms.slug, candidate)),
      )
      .limit(1);
    if (clash.length === 0) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export async function listTerms(
  db: Database,
  taxonomySlug: string,
): Promise<(TermRow & { postCount: number })[]> {
  const tx = await requireTaxonomy(db, taxonomySlug);
  const rows = await db
    .select({
      id: terms.id,
      taxonomyId: terms.taxonomyId,
      name: terms.name,
      slug: terms.slug,
      description: terms.description,
      parentId: terms.parentId,
      createdAt: terms.createdAt,
      postCount: sql<number>`count(${postTerms.postId})`,
    })
    .from(terms)
    .leftJoin(postTerms, eq(postTerms.termId, terms.id))
    .where(eq(terms.taxonomyId, tx.id))
    .groupBy(terms.id)
    .orderBy(terms.name);
  return rows.map((r) => ({ ...r, postCount: Number(r.postCount) }));
}

export async function getTermBySlug(db: Database, taxonomyId: number, slug: string): Promise<TermRow | undefined> {
  return (
    await db.select().from(terms).where(and(eq(terms.taxonomyId, taxonomyId), eq(terms.slug, slug))).limit(1)
  )[0];
}

export async function createTerm(
  db: Database,
  taxonomySlug: string,
  input: { name: string; slug?: string; description?: string | null; parentId?: number | null },
): Promise<TermRow> {
  const tx = await requireTaxonomy(db, taxonomySlug);
  const slug = await uniqueSlug(db, tx.id, input.slug || input.name);
  const res = await db.insert(terms).values({
    taxonomyId: tx.id,
    name: input.name,
    slug,
    description: input.description ?? null,
    parentId: input.parentId ?? null,
  });
  const [header] = res as unknown as [{ insertId: number }];
  return (await db.select().from(terms).where(eq(terms.id, Number(header.insertId))).limit(1))[0]!;
}

export async function updateTerm(
  db: Database,
  id: number,
  input: { name: string; slug?: string; description?: string | null; parentId?: number | null },
): Promise<TermRow> {
  const existing = (await db.select().from(terms).where(eq(terms.id, id)).limit(1))[0];
  if (!existing) throw new TaxonomyError("Term not found");
  const slug = input.slug
    ? await uniqueSlug(db, existing.taxonomyId, input.slug, id)
    : input.name !== existing.name
      ? await uniqueSlug(db, existing.taxonomyId, input.name, id)
      : existing.slug;
  await db
    .update(terms)
    .set({ name: input.name, slug, description: input.description ?? null, parentId: input.parentId ?? null })
    .where(eq(terms.id, id));
  return (await db.select().from(terms).where(eq(terms.id, id)).limit(1))[0]!;
}

export async function deleteTerm(db: Database, id: number): Promise<void> {
  const res = await db.delete(terms).where(eq(terms.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new TaxonomyError("Term not found");
}
