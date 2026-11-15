import { createHash, randomBytes } from "node:crypto";
import { env } from "@pixellize/core/env";
import type { SessionContext } from "@pixellize/core/types";
import { type Database, roles, sessions, users } from "@pixellize/database";
import { eq } from "drizzle-orm";

/** Hash the raw cookie token before it touches the DB (so a DB leak != live sessions). */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(db: Database, userId: number): Promise<CreatedSession> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

/** Resolve a raw cookie token to its user, or null. Expired sessions are purged. */
export async function validateSession(db: Database, token: string): Promise<SessionContext | null> {
  if (!token) return null;
  const sessionId = hashToken(token);
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      status: users.status,
      createdAt: users.createdAt,
      roleName: roles.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now() || row.status !== "active") {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return {
    sessionId: row.sessionId,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: (row.roleName as SessionContext["user"]["role"]) ?? "author",
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

export async function destroySession(db: Database, token: string): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
