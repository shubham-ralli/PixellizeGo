import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { getStorage } from "@pixellize/storage";
import type { FastifyInstance } from "fastify";

const here = dirname(fileURLToPath(import.meta.url));
const adminDir = join(here, "..", "public", "admin");
const siteAssetsDir = join(here, "..", "public", "site", "assets");

export function adminBuilt(): boolean {
  return existsSync(join(adminDir, "index.html"));
}

export function adminIndexHtml(): string | undefined {
  const file = join(adminDir, "index.html");
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

/** Serve uploaded media from the local storage root. */
export async function registerUploads(app: FastifyInstance): Promise<void> {
  const storage = getStorage();
  await mkdir(storage.root, { recursive: true });
  await app.register(fastifyStatic, {
    root: storage.root,
    prefix: storage.publicPath.endsWith("/") ? storage.publicPath : `${storage.publicPath}/`,
    decorateReply: false,
    index: false,
  });
}

/** Serve the built admin SPA under /admin, with history-API fallback. */
export async function registerAdminStatic(app: FastifyInstance): Promise<void> {
  if (!adminBuilt()) {
    app.log.warn("Admin build not found; /admin will 404 until `pnpm build`.");
    return;
  }
  // wildcard:false serves only real files; SPA routes fall through to our handlers.
  await app.register(fastifyStatic, {
    root: adminDir,
    prefix: "/admin/",
    decorateReply: false,
    index: false,
    wildcard: false,
  });
  const index = adminIndexHtml()!;
  const sendIndex = (_req: unknown, reply: { type: (t: string) => { send: (b: string) => unknown } }) =>
    reply.type("text/html").send(index);
  app.get("/admin", sendIndex);
  app.get("/admin/*", sendIndex);
}

/** Serve the built public-site client assets under /assets. */
export async function registerPublicAssets(app: FastifyInstance): Promise<void> {
  if (!existsSync(siteAssetsDir)) return;
  await app.register(fastifyStatic, {
    root: siteAssetsDir,
    prefix: "/assets/",
    decorateReply: false,
    index: false,
  });
}
