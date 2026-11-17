import { type Database, type MenuItem, type MenuRow, menus } from "@pixellize/database";
import { eq } from "drizzle-orm";

export class MenuError extends Error {
  code = "NOT_FOUND" as const;
  constructor(message: string) {
    super(message);
    this.name = "MenuError";
  }
}

export async function listMenus(db: Database): Promise<MenuRow[]> {
  return db.select().from(menus).orderBy(menus.name);
}

export async function getMenu(db: Database, id: number): Promise<MenuRow | undefined> {
  return (await db.select().from(menus).where(eq(menus.id, id)).limit(1))[0];
}

export async function getMenuByLocation(db: Database, location: string): Promise<MenuRow | undefined> {
  return (await db.select().from(menus).where(eq(menus.location, location)).limit(1))[0];
}

export async function createMenu(
  db: Database,
  input: { name: string; location?: string | null; items?: MenuItem[] },
): Promise<MenuRow> {
  const res = await db.insert(menus).values({
    name: input.name,
    location: input.location ?? null,
    items: input.items ?? [],
  });
  const [header] = res as unknown as [{ insertId: number }];
  return (await getMenu(db, Number(header.insertId)))!;
}

export async function updateMenu(
  db: Database,
  id: number,
  input: { name?: string; location?: string | null; items?: MenuItem[] },
): Promise<MenuRow> {
  const existing = await getMenu(db, id);
  if (!existing) throw new MenuError("Menu not found");
  await db
    .update(menus)
    .set({
      name: input.name ?? existing.name,
      location: input.location === undefined ? existing.location : input.location,
      items: input.items ?? existing.items,
    })
    .where(eq(menus.id, id));
  return (await getMenu(db, id))!;
}

export async function deleteMenu(db: Database, id: number): Promise<void> {
  const res = await db.delete(menus).where(eq(menus.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new MenuError("Menu not found");
}
