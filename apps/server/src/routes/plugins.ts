import fastifyMultipart from "@fastify/multipart";
import { env } from "@pixellize/core/env";
import {
  PluginError,
  deletePlugin,
  installPluginFromZip,
  listPlugins,
  setPluginActive,
} from "@pixellize/theme-engine";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function pluginRoutes(app: FastifyInstance): Promise<void> {
  await app.register(fastifyMultipart, {
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  });

  app.addHook("preHandler", app.authenticate);

  app.get("/api/plugins", async () => listPlugins(app.db));

  app.post("/api/plugins/:slug/active", async (request, reply) => {
    const p = z.object({ active: z.boolean() }).safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      await setPluginActive(app.db, (request.params as { slug: string }).slug, p.data.active);
      return { ok: true };
    } catch (err) {
      if (err instanceof PluginError) return reply.code(404).send({ error: "not_found", message: err.message });
      throw err;
    }
  });

  app.post("/api/plugins", async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "no_file", message: "No file uploaded." });
    const buffer = await file.toBuffer();
    if (file.file.truncated) {
      return reply.code(413).send({ error: "file_too_large", message: `Max upload size is ${env.MAX_UPLOAD_MB} MB.` });
    }
    try {
      const row = await installPluginFromZip(app.db, buffer, file.filename);
      return reply.code(201).send(row);
    } catch (err) {
      if (err instanceof PluginError) {
        const status = err.code === "BAD_ZIP" || err.code === "NO_HEADER" ? 400 : 500;
        return reply.code(status).send({ error: err.code.toLowerCase(), message: err.message });
      }
      throw err;
    }
  });

  app.delete("/api/plugins/:slug", async (request, reply) => {
    await deletePlugin(app.db, (request.params as { slug: string }).slug);
    return reply.send({ ok: true });
  });
}
