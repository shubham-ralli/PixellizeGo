import {
  ContentError,
  autosavePost,
  bulkContent,
  createPost,
  forceDeletePost,
  getPost,
  listPosts,
  listRevisions,
  restorePost,
  trashPost,
  updatePost,
} from "@pixellize/content";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

const postBody = z.object({
  type: z.enum(["post", "page"]).optional(),
  title: z.string().min(1).max(255),
  slug: z.string().max(255).optional(),
  excerpt: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  featuredMediaId: z.number().int().positive().nullable().optional(),
  categoryIds: z.array(z.number().int().positive()).optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
  meta: z.record(z.string()).optional(),
});

const listQuery = z.object({
  type: z.enum(["post", "page"]).optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  search: z.string().optional(),
  trashed: z.enum(["0", "1"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

function handleContentError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof ContentError) {
    const status = err.code === "NOT_FOUND" ? 404 : 400;
    reply.code(status).send({ error: err.code.toLowerCase(), message: err.message });
    return true;
  }
  return false;
}

export async function postRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/api/posts", async (request, reply) => {
    const q = listQuery.safeParse(request.query);
    if (!q.success) return reply.code(400).send({ error: "validation_error", message: "Invalid query." });
    const { trashed, ...rest } = q.data;
    return listPosts(app.db, { ...rest, trashed: trashed === "1" });
  });

  // Bulk actions: trash / restore / permanent delete
  app.post("/api/posts/bulk", async (request, reply) => {
    const parsed = z
      .object({
        action: z.enum(["trash", "restore", "delete"]),
        ids: z.array(z.number().int().positive()).min(1).max(200),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    const affected = await bulkContent(app.db, parsed.data.action, parsed.data.ids);
    return { affected };
  });

  app.post("/api/posts", async (request, reply) => {
    const parsed = postBody.safeParse(request.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ error: "validation_error", message: "Invalid input.", details: parsed.error.flatten() });
    try {
      const dto = await createPost(app.db, request.auth!.user.id, parsed.data);
      return reply.code(201).send(dto);
    } catch (err) {
      if (handleContentError(err, reply)) return;
      throw err;
    }
  });

  app.get("/api/posts/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const dto = await getPost(app.db, id);
    if (!dto) return reply.code(404).send({ error: "not_found", message: "Post not found." });
    return dto;
  });

  app.patch("/api/posts/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const parsed = postBody.safeParse(request.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ error: "validation_error", message: "Invalid input.", details: parsed.error.flatten() });
    try {
      return await updatePost(app.db, id, request.auth!.user.id, parsed.data);
    } catch (err) {
      if (handleContentError(err, reply)) return;
      throw err;
    }
  });

  app.post("/api/posts/:id/autosave", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const patch = z
      .object({ title: z.string().max(255).optional(), content: z.string().nullable().optional() })
      .safeParse(request.body);
    if (!patch.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      return await autosavePost(app.db, id, request.auth!.user.id, patch.data);
    } catch (err) {
      if (handleContentError(err, reply)) return;
      throw err;
    }
  });

  app.get("/api/posts/:id/revisions", async (request) => {
    const id = Number((request.params as { id: string }).id);
    return listRevisions(app.db, id);
  });

  // Soft delete (move to trash)
  app.delete("/api/posts/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    try {
      await trashPost(app.db, id);
      return reply.send({ ok: true });
    } catch (err) {
      if (handleContentError(err, reply)) return;
      throw err;
    }
  });

  // Restore from trash
  app.post("/api/posts/:id/restore", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    try {
      await restorePost(app.db, id);
      return reply.send({ ok: true });
    } catch (err) {
      if (handleContentError(err, reply)) return;
      throw err;
    }
  });

  // Permanent delete
  app.delete("/api/posts/:id/force", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    try {
      await forceDeletePost(app.db, id);
      return reply.send({ ok: true });
    } catch (err) {
      if (handleContentError(err, reply)) return;
      throw err;
    }
  });
}
