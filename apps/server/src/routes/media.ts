import fastifyMultipart from "@fastify/multipart";
import { env } from "@pixellize/core/env";
import { MediaError, createMedia, deleteMedia, listMedia, updateMediaAlt } from "@pixellize/media";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  await app.register(fastifyMultipart, {
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  });

  app.addHook("preHandler", app.authenticate);

  app.get("/api/media", async (request) => {
    const q = z
      .object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
      })
      .parse(request.query);
    return listMedia(app.db, q);
  });

  app.post("/api/media", async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "no_file", message: "No file uploaded." });

    const buffer = await file.toBuffer();
    if (file.file.truncated) {
      return reply
        .code(413)
        .send({ error: "file_too_large", message: `Max upload size is ${env.MAX_UPLOAD_MB} MB.` });
    }
    try {
      const row = await createMedia(app.db, {
        buffer,
        originalName: file.filename,
        mimeType: file.mimetype,
        uploadedById: request.auth!.user.id,
      });
      return reply.code(201).send(row);
    } catch (err) {
      if (err instanceof MediaError && err.code === "UNSUPPORTED_TYPE") {
        return reply.code(415).send({ error: "unsupported_type", message: err.message });
      }
      throw err;
    }
  });

  app.patch("/api/media/:id", async (request, reply) => {
    const p = z.object({ altText: z.string().max(255) }).safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    await updateMediaAlt(app.db, Number((request.params as { id: string }).id), p.data.altText);
    return reply.send({ ok: true });
  });

  app.delete("/api/media/:id", async (request, reply) => {
    try {
      await deleteMedia(app.db, Number((request.params as { id: string }).id));
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof MediaError && err.code === "NOT_FOUND") {
        return reply.code(404).send({ error: "not_found", message: err.message });
      }
      throw err;
    }
  });
}
