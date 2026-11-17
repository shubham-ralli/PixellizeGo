import {
  MenuError,
  activateTheme,
  createMenu,
  createRedirect,
  deleteMenu,
  deleteRedirect,
  getMenu,
  getSettings,
  listMenus,
  listRedirects,
  listThemes,
  setSettings,
  setThemeSettings,
  updateMenu,
} from "@pixellize/theme-engine";
import type { MenuItem } from "@pixellize/database";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

const menuItem: z.ZodType<MenuItem> = z.object({
  label: z.string().min(1).max(150),
  url: z.string().min(1).max(512),
  children: z.array(z.lazy(() => menuItem)).optional(),
});

const menuBody = z.object({
  name: z.string().min(1).max(150),
  location: z.string().max(80).nullable().optional(),
  items: z.array(menuItem).default([]),
});

function notFound(err: unknown, reply: FastifyReply): boolean {
  if (err instanceof MenuError) {
    reply.code(404).send({ error: "not_found", message: err.message });
    return true;
  }
  return false;
}

export async function themeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // Settings
  app.get("/api/settings", async () => getSettings(app.db));
  app.put("/api/settings", async (request, reply) => {
    const parsed = z.record(z.string()).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    await setSettings(app.db, parsed.data);
    return { ok: true };
  });

  // Menus
  app.get("/api/menus", async () => listMenus(app.db));
  app.get("/api/menus/:id", async (request, reply) => {
    const row = await getMenu(app.db, Number((request.params as { id: string }).id));
    if (!row) return reply.code(404).send({ error: "not_found", message: "Menu not found." });
    return row;
  });
  app.post("/api/menus", async (request, reply) => {
    const p = menuBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    return reply.code(201).send(await createMenu(app.db, p.data));
  });
  app.patch("/api/menus/:id", async (request, reply) => {
    const p = menuBody.partial().safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    try {
      return await updateMenu(app.db, Number((request.params as { id: string }).id), p.data);
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });
  app.delete("/api/menus/:id", async (request, reply) => {
    try {
      await deleteMenu(app.db, Number((request.params as { id: string }).id));
      return reply.send({ ok: true });
    } catch (err) {
      if (notFound(err, reply)) return;
      throw err;
    }
  });

  // Themes
  app.get("/api/themes", async () => listThemes(app.db));
  app.post("/api/themes/:slug/activate", async (request, reply) => {
    try {
      await activateTheme(app.db, (request.params as { slug: string }).slug);
      return { ok: true };
    } catch {
      return reply.code(404).send({ error: "not_found", message: "Theme not found." });
    }
  });
  app.put("/api/themes/:slug/settings", async (request, reply) => {
    const p = z.record(z.unknown()).safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    await setThemeSettings(app.db, (request.params as { slug: string }).slug, p.data);
    return { ok: true };
  });

  // Redirects
  app.get("/api/redirects", async () => listRedirects(app.db));
  app.post("/api/redirects", async (request, reply) => {
    const p = z
      .object({
        fromPath: z.string().min(1).max(512),
        toPath: z.string().min(1).max(512),
        statusCode: z.union([z.literal(301), z.literal(302)]).optional(),
      })
      .safeParse(request.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", message: "Invalid input." });
    return reply.code(201).send(await createRedirect(app.db, p.data));
  });
  app.delete("/api/redirects/:id", async (request, reply) => {
    await deleteRedirect(app.db, Number((request.params as { id: string }).id));
    return reply.send({ ok: true });
  });
}
