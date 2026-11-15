import type { UserRole } from "@pixellize/core/types";
import { type Database, roles, users } from "@pixellize/database";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "./password.js";
import { AuthError } from "./users.js";

export interface UserListItem {
  id: number;
  name: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  website: string | null;
  role: UserRole;
  avatarUrl: string | null;
  status: "active" | "disabled";
  createdAt: string;
}

async function roleIdByName(db: Database, name: UserRole): Promise<number> {
  const row = (await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1))[0];
  if (!row) throw new AuthError("ROLE_MISSING", `Role "${name}" not found.`);
  return row.id;
}

export async function listUsers(db: Database): Promise<UserListItem[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      bio: users.bio,
      website: users.website,
      avatarUrl: users.avatarUrl,
      status: users.status,
      createdAt: users.createdAt,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(users.createdAt);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    bio: r.bio,
    website: r.website,
    avatarUrl: r.avatarUrl,
    status: r.status as "active" | "disabled",
    createdAt: r.createdAt.toISOString(),
    role: (r.roleName as UserRole) ?? "author",
  }));
}

export async function countAdmins(db: Database): Promise<number> {
  const row = (
    await db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(roles.name, "admin"))
  )[0];
  return Number(row?.c ?? 0);
}

export async function createUser(
  db: Database,
  input: {
    email: string;
    name: string;
    password: string;
    role: UserRole;
    firstName?: string | null;
    lastName?: string | null;
    bio?: string | null;
    website?: string | null;
    avatarUrl?: string | null;
    status?: "active" | "disabled";
  },
): Promise<number> {
  const roleId = await roleIdByName(db, input.role);
  const passwordHash = await hashPassword(input.password);
  try {
    const res = await db.insert(users).values({
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      bio: input.bio || null,
      website: input.website?.trim() || null,
      avatarUrl: input.avatarUrl ?? null,
      status: input.status ?? "active",
      passwordHash,
      roleId,
    });
    const [header] = res as unknown as [{ insertId: number }];
    return Number(header.insertId);
  } catch (err) {
    if (err instanceof Error && /duplicate/i.test(err.message)) {
      throw new AuthError("EMAIL_TAKEN", "That email is already registered.");
    }
    throw err;
  }
}

export async function updateUser(
  db: Database,
  id: number,
  input: {
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    bio?: string | null;
    website?: string | null;
    avatarUrl?: string | null;
    role?: UserRole;
    status?: "active" | "disabled";
    password?: string;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.firstName !== undefined) patch.firstName = input.firstName?.trim() || null;
  if (input.lastName !== undefined) patch.lastName = input.lastName?.trim() || null;
  if (input.bio !== undefined) patch.bio = input.bio || null;
  if (input.website !== undefined) patch.website = input.website?.trim() || null;
  if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
  if (input.role !== undefined) patch.roleId = await roleIdByName(db, input.role);
  if (input.status !== undefined) patch.status = input.status;
  if (input.password) patch.passwordHash = await hashPassword(input.password);
  if (Object.keys(patch).length === 0) return;
  const res = await db.update(users).set(patch).where(eq(users.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new AuthError("INVALID_CREDENTIALS", "User not found.");
}

export async function deleteUser(db: Database, id: number): Promise<void> {
  const res = await db.delete(users).where(eq(users.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new AuthError("INVALID_CREDENTIALS", "User not found.");
}

export async function getUserRole(db: Database, id: number): Promise<UserRole | undefined> {
  const row = (
    await db
      .select({ roleName: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, id))
      .limit(1)
  )[0];
  return row?.roleName as UserRole | undefined;
}
