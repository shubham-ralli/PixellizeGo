import {
  PostTypeError,
  createPostType,
  deletePostType,
  listPostTypes,
  updatePostType,
} from "@pixellize/content";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

const body = z.object({
  slug: z
    .string()
    .max(60)
    .optional(),
  label: z.string().min(1).max(120),
  labelPlural: z.string().min(1).max(120),
  route: z.string().max(120).optional(),
  hasArchive: z.boolean().optional(),
});

function handle(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof PostTypeError) {
    reply.code(err.code === "NOT_FOUND" ? 404 : 409).send({ error: err.code.toLowerCase(), message: err.message });
    return true;
  }
  return false;
}

export async function postTypeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/api/post-types", async () => listPostTypes(app.db));

  app.post("/api/post-types", async (request, reply) => {
    const p = body.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      return reply.code(201).send(await createPostType(app.db, p.data));
    } catch (err) {
      if (handle(err, reply)) return;
      throw err;
    }
  });

  app.patch("/api/post-types/:id", async (request, reply) => {
    const p = body.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      return await updatePostType(app.db, Number((request.params as { id: string }).id), p.data);
    } catch (err) {
      if (handle(err, reply)) return;
      throw err;
    }
  });

  app.delete("/api/post-types/:id", async (request, reply) => {
    try {
      await deletePostType(app.db, Number((request.params as { id: string }).id));
      return reply.send({ ok: true });
    } catch (err) {
      if (handle(err, reply)) return;
      throw err;
    }
  });
}
