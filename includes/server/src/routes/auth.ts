import {
  AuthError,
  authenticateUser,
  countUsers,
  createSession,
  destroySession,
  registerFirstAdmin,
  updateProfile,
} from "@pixellize/auth";
import { env } from "@pixellize/core/env";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clearSessionCookie, setSessionCookie } from "../cookies.js";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

// Stricter limit for credential endpoints to slow brute force (relaxed under test).
const authLimit = {
  rateLimit: { max: env.NODE_ENV === "test" ? 100000 : 10, timeWindow: "1 minute" },
} as const;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Tells the admin UI whether to show first-run registration or the login form.
  app.get("/api/auth/setup-status", async () => {
    return { needsSetup: (await countUsers(app.db)) === 0 };
  });

  app.post("/api/auth/register", { config: authLimit }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", message: "Invalid input.", details: parsed.error.flatten() });
    }
    try {
      const user = await registerFirstAdmin(app.db, parsed.data);
      const { token, expiresAt } = await createSession(app.db, user.id);
      setSessionCookie(reply, token, expiresAt);
      return reply.code(201).send({ user });
    } catch (err) {
      if (err instanceof AuthError) {
        const status = err.code === "EMAIL_TAKEN" || err.code === "REGISTRATION_CLOSED" ? 409 : 400;
        return reply.code(status).send({ error: err.code.toLowerCase(), message: err.message });
      }
      throw err;
    }
  });

  app.post("/api/auth/login", { config: authLimit }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    }
    try {
      const user = await authenticateUser(app.db, parsed.data.email, parsed.data.password);
      const { token, expiresAt } = await createSession(app.db, user.id);
      setSessionCookie(reply, token, expiresAt);
      return reply.send({ user });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: "invalid_credentials", message: err.message });
      }
      throw err;
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const raw = request.cookies[env.SESSION_COOKIE_NAME];
    if (raw) {
      const unsigned = request.unsignCookie(raw);
      if (unsigned.valid && unsigned.value) await destroySession(app.db, unsigned.value);
    }
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", { preHandler: app.authenticate }, async (request) => {
    return { user: request.auth!.user };
  });

  const profileSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    firstName: z.string().max(120).nullable().optional(),
    lastName: z.string().max(120).nullable().optional(),
    bio: z.string().max(5000).nullable().optional(),
    website: z.string().max(255).nullable().optional(),
    avatarUrl: z.string().max(512).nullable().optional(),
  });

  app.patch("/api/auth/profile", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    }
    await updateProfile(app.db, request.auth!.user.id, parsed.data);
    const pick = <T>(v: T | undefined, fallback: T): T => (v !== undefined ? v : fallback);
    const u = request.auth!.user;
    return {
      user: {
        ...u,
        name: parsed.data.name ?? u.name,
        firstName: pick(parsed.data.firstName, u.firstName),
        lastName: pick(parsed.data.lastName, u.lastName),
        bio: pick(parsed.data.bio, u.bio),
        website: pick(parsed.data.website, u.website),
        avatarUrl: pick(parsed.data.avatarUrl, u.avatarUrl),
      },
    };
  });
}
