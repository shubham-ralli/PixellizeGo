import { media, posts, users } from "@pixellize/database";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/dashboard/stats", { preHandler: app.authenticate }, async () => {
    const one = (p: Promise<{ c: number }[]>) => p.then((r) => Number(r[0]?.c ?? 0));
    const cc = sql<number>`count(*)`;
    const [users_, posts_, pages_, media_] = await Promise.all([
      one(app.db.select({ c: cc }).from(users)),
      one(app.db.select({ c: cc }).from(posts).where(and(eq(posts.type, "post"), isNull(posts.deletedAt)))),
      one(app.db.select({ c: cc }).from(posts).where(and(eq(posts.type, "page"), isNull(posts.deletedAt)))),
      one(app.db.select({ c: cc }).from(media)),
    ]);

    const recentPosts = await app.db
      .select({
        id: posts.id,
        title: posts.title,
        type: posts.type,
        status: posts.status,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(and(eq(posts.type, "post"), isNull(posts.deletedAt)))
      .orderBy(desc(posts.updatedAt))
      .limit(5);

    const recentUsers = await app.db
      .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(5);

    return {
      totals: { users: users_, posts: posts_, pages: pages_, media: media_ },
      recentPosts: recentPosts.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() })),
      recentUsers: recentUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    };
  });
}
