import {
  TaxonomyError,
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  listCategories,
  listTags,
  updateCategory,
  updateTag,
} from "@pixellize/content";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

const categoryBody = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().max(140).optional(),
  description: z.string().max(255).nullable().optional(),
  parentId: z.number().int().positive().nullable().optional(),
});
const tagBody = z.object({ name: z.string().min(1).max(120), slug: z.string().max(140).optional() });

function notFound(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof TaxonomyError) {
    reply.code(404).send({ error: "not_found", message: err.message });
    return true;
  }
  return false;
}

export async function taxonomyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // Categories
  app.get("/api/categories", async () => listCategories(app.db));
  app.post("/api/categories", async (request, reply) => {
    const p = categoryBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    return reply.code(201).send(await createCategory(app.db, p.data));
  });
  app.patch("/api/categories/:id", async (request, reply) => {
    const p = categoryBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      return await updateCategory(app.db, Number((request.params as { id: string }).id), p.data);
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });
  app.delete("/api/categories/:id", async (request, reply) => {
    try {
      await deleteCategory(app.db, Number((request.params as { id: string }).id));
      return reply.send({ ok: true });
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });

  // Tags
  app.get("/api/tags", async () => listTags(app.db));
  app.post("/api/tags", async (request, reply) => {
    const p = tagBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    return reply.code(201).send(await createTag(app.db, p.data));
  });
  app.patch("/api/tags/:id", async (request, reply) => {
    const p = tagBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      return await updateTag(app.db, Number((request.params as { id: string }).id), p.data);
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });
  app.delete("/api/tags/:id", async (request, reply) => {
    try {
      await deleteTag(app.db, Number((request.params as { id: string }).id));
      return reply.send({ ok: true });
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });
}
