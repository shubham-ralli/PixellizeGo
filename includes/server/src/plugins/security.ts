import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import { env } from "@pixellize/core/env";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

async function securityPlugin(app: FastifyInstance): Promise<void> {
  // Security headers. CSP is relaxed here because the admin SPA is served separately;
  // tighten per-deployment in Phase 5.
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });

  // Admin dev server runs on a different origin and needs to send the session cookie.
  await app.register(fastifyCors, {
    origin: env.ADMIN_ORIGIN,
    credentials: true,
  });

  // Global ceiling; auth routes set a stricter per-route limit.
  await app.register(fastifyRateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
  });
}

export default fp(securityPlugin, { name: "security" });
