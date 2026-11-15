import { type Database, type RedirectRow, redirects } from "@pixellize/database";
import { eq } from "drizzle-orm";

export async function listRedirects(db: Database): Promise<RedirectRow[]> {
  return db.select().from(redirects).orderBy(redirects.fromPath);
}

export async function getRedirectByFrom(db: Database, fromPath: string): Promise<RedirectRow | undefined> {
  return (await db.select().from(redirects).where(eq(redirects.fromPath, fromPath)).limit(1))[0];
}

export async function createRedirect(
  db: Database,
  input: { fromPath: string; toPath: string; statusCode?: number },
): Promise<RedirectRow> {
  const fromPath = input.fromPath.startsWith("/") ? input.fromPath : `/${input.fromPath}`;
  await db
    .insert(redirects)
    .values({ fromPath, toPath: input.toPath, statusCode: input.statusCode ?? 301 })
    .onDuplicateKeyUpdate({ set: { toPath: input.toPath, statusCode: input.statusCode ?? 301 } });
  return (await getRedirectByFrom(db, fromPath))!;
}

export async function deleteRedirect(db: Database, id: number): Promise<void> {
  await db.delete(redirects).where(eq(redirects.id, id));
}
