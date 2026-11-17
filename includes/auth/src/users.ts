import type { PublicUser, UserRole } from "@pixellize/core/types";
import { type Database, roles, users } from "@pixellize/database";
import { eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./password.js";

export class AuthError extends Error {
  constructor(
    public code: "REGISTRATION_CLOSED" | "EMAIL_TAKEN" | "INVALID_CREDENTIALS" | "ROLE_MISSING",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

async function roleIdByName(db: Database, name: UserRole): Promise<number> {
  const row = (await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1))[0];
  if (!row) throw new AuthError("ROLE_MISSING", `Role "${name}" not found. Run the DB seed first.`);
  return row.id;
}

export async function countUsers(db: Database): Promise<number> {
  const row = (await db.select({ c: sql<number>`count(*)` }).from(users))[0];
  return Number(row?.c ?? 0);
}

/**
 * Phase 1: open registration only bootstraps the first admin.
 * Once any user exists, self-registration is closed (user management comes in Phase 2).
 */
export async function registerFirstAdmin(db: Database, input: RegisterInput): Promise<PublicUser> {
  if ((await countUsers(db)) > 0) {
    throw new AuthError("REGISTRATION_CLOSED", "An account already exists. Please sign in.");
  }
  const roleId = await roleIdByName(db, "admin");
  const passwordHash = await hashPassword(input.password);
  try {
    const result = await db.insert(users).values({
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      passwordHash,
      roleId,
    });
    // drizzle(mysql2) returns [ResultSetHeader, FieldPacket[]]
    const [header] = result as unknown as [{ insertId: number }];
    const insertId = Number(header.insertId);
    return {
      id: insertId,
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      firstName: null,
      lastName: null,
      bio: null,
      website: null,
      role: "admin",
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && /duplicate/i.test(err.message)) {
      throw new AuthError("EMAIL_TAKEN", "That email is already registered.");
    }
    throw err;
  }
}

export async function authenticateUser(
  db: Database,
  email: string,
  password: string,
): Promise<PublicUser> {
  const row = (
    await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        bio: users.bio,
        website: users.website,
        passwordHash: users.passwordHash,
        avatarUrl: users.avatarUrl,
        status: users.status,
        createdAt: users.createdAt,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1)
  )[0];

  // Always run a verify to blunt timing/user-enumeration differences.
  const ok =
    row && row.status === "active"
      ? await verifyPassword(row.passwordHash, password)
      : await verifyPassword(
          "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$0000000000000000000000000000000000000000000",
          password,
        );

  if (!row || !ok) throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    bio: row.bio,
    website: row.website,
    role: (row.roleName as UserRole) ?? "author",
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ProfileInput {
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  website?: string | null;
  avatarUrl?: string | null;
}

/** Update the signed-in user's own profile. */
export async function updateProfile(db: Database, userId: number, input: ProfileInput): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.firstName !== undefined) patch.firstName = input.firstName?.trim() || null;
  if (input.lastName !== undefined) patch.lastName = input.lastName?.trim() || null;
  if (input.bio !== undefined) patch.bio = input.bio || null;
  if (input.website !== undefined) patch.website = input.website?.trim() || null;
  if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
  if (Object.keys(patch).length === 0) return;
  await db.update(users).set(patch).where(eq(users.id, userId));
}
