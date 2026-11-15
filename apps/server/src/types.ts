import type { SessionContext } from "@pixellize/core/types";
import type { Database } from "@pixellize/database";
import type { FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    /** preHandler: 401s unless a valid session cookie is present; sets request.auth. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    auth: SessionContext | null;
  }
}
