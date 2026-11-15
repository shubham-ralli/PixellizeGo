import { env, isProd } from "@pixellize/core/env";
import { type Database, getDb } from "@pixellize/database";
import { getRedirectByFrom } from "@pixellize/theme-engine";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import authPlugin from "./plugins/auth.js";
import securityPlugin from "./plugins/security.js";
import { authRoutes } from "./routes/auth.js";
import { cronRoutes } from "./routes/cron.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { healthRoutes } from "./routes/health.js";
import { mediaRoutes } from "./routes/media.js";
import { postRoutes } from "./routes/posts.js";
import { publicRoutes, render404 } from "./routes/public.js";
import { taxonomyRoutes } from "./routes/taxonomy.js";
import { themeRoutes } from "./routes/themes.js";
import { userRoutes } from "./routes/users.js";
import { registerAdminBarAssets } from "./admin-bar.js";
import { registerAdminStatic, registerPublicAssets, registerUploads } from "./serve-static.js";

export interface BuildOptions {
  db?: Database;
  logger?: boolean;
}

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? (isProd ? true : { transport: { target: "pino-pretty" } }),
    trustProxy: true,
  });

  app.decorate("db", opts.db ?? getDb());

  await app.register(securityPlugin);
  await app.register(authPlugin);

  // Managed redirects (301/302) for public GET paths.
  // ponytail: per-request DB lookup; add an in-memory cache if traffic grows.
  app.addHook("onRequest", async (request, reply) => {
    if (request.method !== "GET") return;
    const path = request.url.split("?")[0] ?? "/";
    if (/^\/(api|admin|uploads|assets|admin-bar|sitemap|robots)\b/.test(path)) return;
    const redirect = await getRedirectByFrom(app.db, path);
    if (redirect) return reply.redirect(redirect.toPath, redirect.statusCode);
  });

  // API
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(dashboardRoutes);
  await app.register(postRoutes);
  await app.register(taxonomyRoutes);
  await app.register(mediaRoutes);
  await app.register(themeRoutes);
  await app.register(userRoutes);
  await app.register(cronRoutes);

  // Static: uploads, admin SPA (/admin), public client assets (/assets)
  await registerUploads(app);
  await registerAdminStatic(app);
  await registerPublicAssets(app);
  await registerAdminBarAssets(app);

  // Public website (SSR): /, /blog/:slug, /category|tag/:slug, /:slug, sitemap, robots
  await app.register(publicRoutes);

  // Unmatched: API -> JSON 404; everything else -> SSR 404 page
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "not_found", message: "Route not found." });
    }
    return render404(app, request, reply);
  });

  app.setErrorHandler((err: FastifyError, request, reply) => {
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.code ?? "error", message: err.message });
    }
    request.log.error({ err }, "unhandled error");
    return reply.code(500).send({ error: "internal_error", message: "Something went wrong." });
  });

  return app;
}

export { env };
