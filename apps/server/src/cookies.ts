import { env, isProd } from "@pixellize/core/env";
import type { FastifyReply } from "fastify";

const COOKIE_PATH = "/";

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd, // requires HTTPS in production
    sameSite: "strict", // blocks cross-site sending -> primary CSRF defense for Phase 1
    path: COOKIE_PATH,
    expires: expiresAt,
    signed: true,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(env.SESSION_COOKIE_NAME, { path: COOKIE_PATH });
}
