import {
  CommentError,
  bulkComments,
  createComment,
  createReply,
  deleteComment,
  listCommentsAdmin,
  setCommentStatus,
} from "@pixellize/content";
import type { CommentStatus } from "@pixellize/content";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

const submitBody = z.object({
  postId: z.number().int().positive(),
  authorName: z.string().min(1).max(120),
  authorEmail: z.string().email().max(190),
  authorUrl: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(5000),
});

const statusEnum = z.enum(["pending", "approved", "spam", "trash"]);

function handle(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof CommentError) {
    reply.code(err.code === "NOT_FOUND" ? 404 : 400).send({ error: err.code.toLowerCase(), message: err.message });
    return true;
  }
  return false;
}

export async function commentRoutes(app: FastifyInstance): Promise<void> {
  // Public: submit a comment (no auth). Lands in the moderation queue as "pending".
  app.post("/api/comments", async (request, reply) => {
    const p = submitBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      await createComment(app.db, p.data);
      return reply.code(201).send({ ok: true, pending: true });
    } catch (err) {
      if (handle(err, reply)) return;
      throw err;
    }
  });

  // Admin moderation (auth required).
  app.get("/api/comments", { preHandler: app.authenticate }, async (request, reply) => {
    const q = z
      .object({ status: statusEnum.optional(), limit: z.coerce.number().int().positive().max(200).optional() })
      .safeParse(request.query);
    if (!q.success) return reply.code(400).send({ error: "validation_error", message: "Invalid query." });
    return listCommentsAdmin(app.db, q.data);
  });

  app.patch("/api/comments/:id", { preHandler: app.authenticate }, async (request, reply) => {
    const p = z.object({ status: statusEnum }).safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      await setCommentStatus(app.db, Number((request.params as { id: string }).id), p.data.status as CommentStatus);
      return reply.send({ ok: true });
    } catch (err) {
      if (handle(err, reply)) return;
      throw err;
    }
  });

  // Admin reply to a comment — author is the logged-in user, auto-approved.
  app.post("/api/comments/:id/reply", { preHandler: app.authenticate }, async (request, reply) => {
    const p = z.object({ content: z.string().min(1).max(5000) }).safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    const me = request.auth!.user;
    try {
      await createReply(app.db, Number((request.params as { id: string }).id), {
        authorName: me.name,
        authorEmail: me.email,
        content: p.data.content,
      });
      return reply.code(201).send({ ok: true });
    } catch (err) {
      if (handle(err, reply)) return;
      throw err;
    }
  });

  app.delete("/api/comments/:id", { preHandler: app.authenticate }, async (request, reply) => {
    try {
      await deleteComment(app.db, Number((request.params as { id: string }).id));
      return reply.send({ ok: true });
    } catch (err) {
      if (handle(err, reply)) return;
      throw err;
    }
  });

  app.post("/api/comments/bulk", { preHandler: app.authenticate }, async (request, reply) => {
    const p = z
      .object({
        action: z.enum(["approve", "spam", "trash", "delete"]),
        ids: z.array(z.number().int().positive()).min(1).max(200),
      })
      .safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    const affected = await bulkComments(app.db, p.data.action, p.data.ids);
    return { affected };
  });
}
