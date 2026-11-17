import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async (_req, reply) => {
    let dbOk = false;
    try {
      await app.db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch (err) {
      app.log.error({ err }, "health: db check failed");
    }
    const body = {
      status: dbOk ? "ok" : "degraded",
      uptime: process.uptime(),
      db: dbOk,
      timestamp: new Date().toISOString(),
    };
    return reply.code(dbOk ? 200 : 503).send(body);
  });
}
