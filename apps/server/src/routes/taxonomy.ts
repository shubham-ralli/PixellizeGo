import {
  TaxonomyError,
  createTerm,
  deleteTerm,
  listTaxonomies,
  listTerms,
  updateTerm,
} from "@pixellize/content";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

const termBody = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().max(140).optional(),
  description: z.string().max(255).nullable().optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

function notFound(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof TaxonomyError) {
    reply.code(404).send({ error: "not_found", message: err.message });
    return true;
  }
  return false;
}

export async function taxonomyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // Taxonomies (category, tag, …)
  app.get("/api/taxonomies", async () => listTaxonomies(app.db));

  // Terms within a taxonomy
  app.get("/api/taxonomies/:tax/terms", async (request, reply) => {
    try {
      return await listTerms(app.db, (request.params as { tax: string }).tax);
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });

  app.post("/api/taxonomies/:tax/terms", async (request, reply) => {
    const p = termBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      return reply.code(201).send(await createTerm(app.db, (request.params as { tax: string }).tax, p.data));
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });

  app.patch("/api/terms/:id", async (request, reply) => {
    const p = termBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      return await updateTerm(app.db, Number((request.params as { id: string }).id), p.data);
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });

  app.delete("/api/terms/:id", async (request, reply) => {
    try {
      await deleteTerm(app.db, Number((request.params as { id: string }).id));
      return reply.send({ ok: true });
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });
}
