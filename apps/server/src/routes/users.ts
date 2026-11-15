import {
  AuthError,
  countAdmins,
  createUser,
  deleteUser,
  getUserRole,
  listUsers,
  updateUser,
} from "@pixellize/auth";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const roleEnum = z.enum(["admin", "editor", "author"]);

const createBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
  role: roleEnum,
});

const updateBody = z.object({
  name: z.string().min(1).max(120).optional(),
  role: roleEnum.optional(),
  status: z.enum(["active", "disabled"]).optional(),
  password: z.string().min(8).max(200).optional(),
});

function handleAuthError(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof AuthError) {
    const status = err.code === "EMAIL_TAKEN" ? 409 : err.code === "INVALID_CREDENTIALS" ? 404 : 400;
    reply.code(status).send({ error: err.code.toLowerCase(), message: err.message });
    return true;
  }
  return false;
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // Authenticated + admin-only for the whole group.
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.auth && request.auth.user.role !== "admin") {
      reply.code(403).send({ error: "forbidden", message: "Admins only." });
    }
  });

  app.get("/api/users", async () => listUsers(app.db));

  app.post("/api/users", async (request, reply) => {
    const p = createBody.safeParse(request.body);
    if (!p.success) {
      return reply.code(400).send({ error: "validation_error", message: "Invalid input.", details: p.error.flatten() });
    }
    try {
      const id = await createUser(app.db, p.data);
      return reply.code(201).send({ id });
    } catch (err) {
      if (handleAuthError(err, reply)) return;
      throw err;
    }
  });

  app.patch("/api/users/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const p = updateBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });

    // Guard: don't let the last admin lose admin / be disabled.
    if ((p.data.role && p.data.role !== "admin") || p.data.status === "disabled") {
      const current = await getUserRole(app.db, id);
      if (current === "admin" && (await countAdmins(app.db)) <= 1) {
        return reply.code(409).send({ error: "last_admin", message: "Cannot demote or disable the last admin." });
      }
    }
    try {
      await updateUser(app.db, id, p.data);
      return { ok: true };
    } catch (err) {
      if (handleAuthError(err, reply)) return;
      throw err;
    }
  });

  app.delete("/api/users/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (id === request.auth!.user.id) {
      return reply.code(409).send({ error: "self_delete", message: "You cannot delete your own account." });
    }
    const role = await getUserRole(app.db, id);
    if (role === "admin" && (await countAdmins(app.db)) <= 1) {
      return reply.code(409).send({ error: "last_admin", message: "Cannot delete the last admin." });
    }
    try {
      await deleteUser(app.db, id);
      return { ok: true };
    } catch (err) {
      if (handleAuthError(err, reply)) return;
      throw err;
    }
  });
}
