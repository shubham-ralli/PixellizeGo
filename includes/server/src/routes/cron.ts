import { publishDueScheduled } from "@pixellize/content";
import { env } from "@pixellize/core/env";
import type { FastifyInstance } from "fastify";

/**
 * Cron-triggered scheduled publishing for hosts without persistent workers.
 * Protected by a shared secret header; disabled if CRON_SECRET is unset.
 *   curl -H "x-cron-secret: <secret>" -X POST <host>/api/cron/publish-scheduled
 */
export async function cronRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/cron/publish-scheduled", async (request, reply) => {
    if (!env.CRON_SECRET) {
      return reply.code(503).send({ error: "disabled", message: "CRON_SECRET not configured." });
    }
    if (request.headers["x-cron-secret"] !== env.CRON_SECRET) {
      return reply.code(401).send({ error: "unauthorized", message: "Invalid cron secret." });
    }
    const published = await publishDueScheduled(app.db);
    return { published };
  });
}
