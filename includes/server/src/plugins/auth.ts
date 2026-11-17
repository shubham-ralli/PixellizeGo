import fastifyCookie from "@fastify/cookie";
import { env } from "@pixellize/core/env";
import { validateSession } from "@pixellize/auth";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

/** Reads + validates the signed session cookie; exposes `app.authenticate`. */
async function authPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyCookie, { secret: env.SESSION_SECRET });

  app.decorateRequest("auth", null);

  async function resolveAuth(request: FastifyRequest): Promise<void> {
    const raw = request.cookies[env.SESSION_COOKIE_NAME];
    if (!raw) {
      request.auth = null;
      return;
    }
    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) {
      request.auth = null;
      return;
    }
    request.auth = await validateSession(app.db, unsigned.value);
  }

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    await resolveAuth(request);
    if (!request.auth) {
      reply.code(401).send({ error: "unauthorized", message: "Authentication required." });
    }
  });
}

export default fp(authPlugin, { name: "auth" });
