import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMedia, deleteMedia } from "@pixellize/media";
import { type Database, createDatabase, roles } from "@pixellize/database";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "mysql://root@localhost:3306/pixellize_cms_test";
const migrationsFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "packages",
  "database",
  "migrations",
);

// 1x1 transparent PNG
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

let app: Awaited<ReturnType<typeof buildApp>>;
let pool: ReturnType<typeof createDatabase>["pool"];
let db: Database;

function cookieHeaderFrom(res: { cookies: { name: string; value: string }[] }): string {
  return res.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

beforeAll(async () => {
  const url = new URL(TEST_URL);
  const dbName = url.pathname.slice(1);
  const admin = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await admin.end();

  const created = createDatabase(TEST_URL);
  db = created.db;
  pool = created.pool;
  await migrate(db, { migrationsFolder });

  await pool.query("SET FOREIGN_KEY_CHECKS=0");
  for (const t of [
    "post_tags",
    "post_categories",
    "post_meta",
    "revisions",
    "posts",
    "tags",
    "categories",
    "media",
    "sessions",
    "users",
  ]) {
    await pool.query(`TRUNCATE TABLE ${t}`);
  }
  await pool.query("SET FOREIGN_KEY_CHECKS=1");
  for (const r of [
    { name: "admin", description: "admin" },
    { name: "editor", description: "editor" },
    { name: "author", description: "author" },
  ]) {
    await db.insert(roles).values(r).onDuplicateKeyUpdate({ set: { description: r.description } });
  }

  app = await buildApp({ db, logger: false });
  await app.ready();
}, 30_000);

afterAll(async () => {
  await app?.close();
  await pool?.end();
});

describe("Phase 1 foundation API", () => {
  const creds = { email: "admin@example.com", name: "Site Admin", password: "supersecret123" };
  let cookie = "";

  it("health check reports db ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", db: true });
  });

  it("registers the first admin and sets a session cookie", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: creds });
    expect(res.statusCode).toBe(201);
    expect(res.json().user).toMatchObject({ email: creds.email, role: "admin" });
    cookie = cookieHeaderFrom(res);
    expect(cookie).toContain("pcms_session=");
  });

  it("returns the current user from the session cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(creds.email);
  });

  it("rejects /me without a cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("logs out and invalidates the session", async () => {
    const logout = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(logout.statusCode).toBe(200);
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });
});

describe("Phase 2 content API", () => {
  let cookie = "";

  beforeAll(async () => {
    // Log in using the admin created in the Phase 1 block.
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "supersecret123" },
    });
    cookie = cookieHeaderFrom(login);
  });

  it("requires auth for posts", async () => {
    const res = await app.inject({ method: "GET", url: "/api/posts" });
    expect(res.statusCode).toBe(401);
  });

  let categoryId = 0;
  let tagId = 0;

  it("creates a category and a tag with generated slugs", async () => {
    const cat = await app.inject({
      method: "POST",
      url: "/api/categories",
      headers: { cookie },
      payload: { name: "News & Updates" },
    });
    expect(cat.statusCode).toBe(201);
    expect(cat.json().slug).toBe("news-updates");
    categoryId = cat.json().id;

    const tag = await app.inject({
      method: "POST",
      url: "/api/tags",
      headers: { cookie },
      payload: { name: "Release" },
    });
    expect(tag.statusCode).toBe(201);
    tagId = tag.json().id;
  });

  let postId = 0;

  it("creates a draft post with taxonomy + SEO meta", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie },
      payload: {
        type: "post",
        title: "Hello World",
        content: "<p>First post</p>",
        status: "draft",
        categoryIds: [categoryId],
        tagIds: [tagId],
        meta: { metaTitle: "Hello SEO", metaDescription: "desc" },
      },
    });
    expect(res.statusCode).toBe(201);
    const dto = res.json();
    postId = dto.id;
    expect(dto.slug).toBe("hello-world");
    expect(dto.categories).toHaveLength(1);
    expect(dto.tags).toHaveLength(1);
    expect(dto.meta.metaTitle).toBe("Hello SEO");
    expect(dto.status).toBe("draft");
    expect(dto.publishedAt).toBeNull();
  });

  it("rejects a scheduled post with a past date", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie },
      payload: { title: "Past", status: "scheduled", scheduledAt: "2000-01-01T00:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("publishes the post on update and sets publishedAt", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/posts/${postId}`,
      headers: { cookie },
      payload: { title: "Hello World", content: "<p>updated</p>", status: "published" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("published");
    expect(res.json().publishedAt).not.toBeNull();
  });

  it("autosaves and records a revision", async () => {
    const save = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/autosave`,
      headers: { cookie },
      payload: { content: "<p>autosaved draft</p>" },
    });
    expect(save.statusCode).toBe(200);
    const revs = await app.inject({ method: "GET", url: `/api/posts/${postId}/revisions`, headers: { cookie } });
    expect(revs.json().length).toBeGreaterThanOrEqual(2); // create + publish + autosave
    expect(revs.json().some((r: { kind: string }) => r.kind === "autosave")).toBe(true);
  });

  it("lists posts filtered by type", async () => {
    const res = await app.inject({ method: "GET", url: "/api/posts?type=post", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBeGreaterThanOrEqual(1);
    expect(res.json().items[0]).toHaveProperty("authorName");
  });

  it("uploads + stores media with dimensions, then deletes it", async () => {
    const row = await createMedia(db, {
      buffer: PNG_1X1,
      originalName: "dot.png",
      mimeType: "image/png",
    });
    expect(row.width).toBe(1);
    expect(row.height).toBe(1);
    expect(row.url).toMatch(/^\/uploads\//);
    await deleteMedia(db, row.id);
  });

  it("reflects content counts on the dashboard", async () => {
    const res = await app.inject({ method: "GET", url: "/api/dashboard/stats", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().totals.posts).toBeGreaterThanOrEqual(1);
    expect(res.json().recentPosts.length).toBeGreaterThanOrEqual(1);
  });

  it("soft-deletes (trash), restores, and permanently deletes a post", async () => {
    // Trash
    const trash = await app.inject({ method: "DELETE", url: `/api/posts/${postId}`, headers: { cookie } });
    expect(trash.statusCode).toBe(200);
    // Not in active list, but in trash list
    const active = await app.inject({ method: "GET", url: "/api/posts?type=post", headers: { cookie } });
    expect(active.json().items.some((p: { id: number }) => p.id === postId)).toBe(false);
    const trashed = await app.inject({ method: "GET", url: "/api/posts?type=post&trashed=1", headers: { cookie } });
    expect(trashed.json().items.some((p: { id: number }) => p.id === postId)).toBe(true);
    // Not visible on the public site while trashed
    const pub = await app.inject({ method: "GET", url: "/blog/hello-world?__json=1" });
    expect(pub.statusCode).toBe(404);
    // Restore
    const restore = await app.inject({ method: "POST", url: `/api/posts/${postId}/restore`, headers: { cookie } });
    expect(restore.statusCode).toBe(200);
    const back = await app.inject({ method: "GET", url: "/api/posts?type=post", headers: { cookie } });
    expect(back.json().items.some((p: { id: number }) => p.id === postId)).toBe(true);
    // Permanent delete
    const force = await app.inject({ method: "DELETE", url: `/api/posts/${postId}/force`, headers: { cookie } });
    expect(force.statusCode).toBe(200);
    const gone = await app.inject({ method: "GET", url: `/api/posts/${postId}`, headers: { cookie } });
    expect(gone.statusCode).toBe(404);
  });

  it("bulk-trashes posts", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie },
      payload: { type: "post", title: "Bulk One", status: "draft" },
    });
    const id = created.json().id;
    const bulk = await app.inject({
      method: "POST",
      url: "/api/posts/bulk",
      headers: { cookie },
      payload: { action: "trash", ids: [id] },
    });
    expect(bulk.statusCode).toBe(200);
    expect(bulk.json().affected).toBe(1);
    const trashed = await app.inject({ method: "GET", url: "/api/posts?type=post&trashed=1", headers: { cookie } });
    expect(trashed.json().items.some((p: { id: number }) => p.id === id)).toBe(true);
  });
});

describe("Phase 3 admin management API", () => {
  let cookie = "";

  beforeAll(async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "supersecret123" },
    });
    cookie = cookieHeaderFrom(login);
  });

  it("requires auth for users list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users" });
    expect(res.statusCode).toBe(401);
  });

  it("lists users (admin) including the admin", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().some((u: { role: string }) => u.role === "admin")).toBe(true);
  });

  let editorId = 0;
  it("creates a new editor user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { cookie },
      payload: { name: "Ed", email: "ed@example.com", password: "editorpass1", role: "editor" },
    });
    expect(res.statusCode).toBe(201);
    editorId = res.json().id;
    expect(editorId).toBeGreaterThan(0);
  });

  it("rejects duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { cookie },
      payload: { name: "Dup", email: "ed@example.com", password: "editorpass1", role: "author" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("blocks deleting the last admin", async () => {
    const admin = (await app.inject({ method: "GET", url: "/api/users", headers: { cookie } }).then((r) => r.json())).find(
      (u: { role: string; id: number }) => u.role === "admin",
    );
    const res = await app.inject({ method: "DELETE", url: `/api/users/${admin.id}`, headers: { cookie } });
    expect(res.statusCode).toBe(409); // self-delete / last-admin guard
  });

  it("deletes the editor", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/users/${editorId}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });

  it("saves and reads site settings", async () => {
    const put = await app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: { cookie },
      payload: { siteTitle: "My CMS", postsPerPage: "7" },
    });
    expect(put.statusCode).toBe(200);
    const get = await app.inject({ method: "GET", url: "/api/settings", headers: { cookie } });
    expect(get.json().siteTitle).toBe("My CMS");
  });

  it("creates a redirect and serves it on the public site", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/redirects",
      headers: { cookie },
      payload: { fromPath: "/old-link", toPath: "/", statusCode: 301 },
    });
    expect(create.statusCode).toBe(201);
    const hit = await app.inject({ method: "GET", url: "/old-link" });
    expect(hit.statusCode).toBe(301);
    expect(hit.headers.location).toBe("/");
  });
});
