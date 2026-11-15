import {
  type PostDTO,
  getPostTypeByRoute,
  getPublishedByPath,
  getPublishedBySlug,
  listPublishedByTerm,
  listPublishedForSitemap,
  listPublishedPosts,
} from "@pixellize/content";
import {
  getActiveTheme,
  getMenuByLocation,
  getSettingsFor,
  SEO_SETTING_KEYS,
  SITE_SETTING_KEYS,
} from "@pixellize/theme-engine";
import { buildMeta, generateSitemap, renderMetaTags, robotsTxt } from "@pixellize/seo";
import { validateSession } from "@pixellize/auth";
import { env } from "@pixellize/core/env";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { type AdminBarData, renderAdminBarInjection } from "../admin-bar.js";
import { frontendBuilt, notBuiltPage, renderPage } from "../frontend.js";

interface AdminBar {
  user: string;
  dashboardUrl: string;
  newPostUrl: string;
  logoutUrl: string;
  editUrl: string | null;
}

interface SeoDefaults {
  description?: string;
  ogImage?: string;
  separator: string;
  robots?: string;
}

interface MenuNode {
  label: string;
  url: string;
  children?: MenuNode[];
}

interface BaseContext {
  site: { title: string; tagline: string; baseUrl: string };
  menu: MenuNode[];
  themeSettings: Record<string, unknown>;
  seo: SeoDefaults;
  adminBar?: AdminBar;
}

/** Map stored menu items to the public shape, preserving one level of children. */
function mapMenu(items: { label: string; url: string; children?: MenuNode[] }[]): MenuNode[] {
  return items.map((i) => ({
    label: i.label,
    url: i.url,
    ...(i.children && i.children.length > 0 ? { children: mapMenu(i.children) } : {}),
  }));
}

/** If the viewer has a valid session, build the admin toolbar context (server-driven). */
async function resolveAdminBar(app: FastifyInstance, req: FastifyRequest): Promise<AdminBar | undefined> {
  const raw = req.cookies[env.SESSION_COOKIE_NAME];
  if (!raw) return undefined;
  const unsigned = req.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return undefined;
  const session = await validateSession(app.db, unsigned.value);
  if (!session) return undefined;
  return {
    user: session.user.name,
    dashboardUrl: "/admin",
    newPostUrl: "/admin/content/post/new",
    logoutUrl: "/admin/logout",
    editUrl: null,
  };
}

async function baseContext(app: FastifyInstance, req: FastifyRequest): Promise<BaseContext> {
  const settings = await getSettingsFor(app.db, [...SITE_SETTING_KEYS, ...SEO_SETTING_KEYS]);
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const baseUrl = (settings.siteUrl || `${proto}://${req.headers.host}`).replace(/\/$/, "");
  const menuRow = await getMenuByLocation(app.db, "primary");
  const theme = await getActiveTheme(app.db);
  const adminBar = await resolveAdminBar(app, req);
  return {
    site: {
      title: settings.siteTitle || "Pixellize",
      tagline: settings.tagline || "",
      baseUrl,
    },
    menu: mapMenu(menuRow?.items ?? []),
    themeSettings: (theme?.settings as Record<string, unknown>) ?? {},
    seo: {
      description: settings.seoMetaDescription || undefined,
      ogImage: settings.seoDefaultOgImage ? baseUrl + settings.seoDefaultOgImage : undefined,
      separator: settings.seoTitleSeparator || "—",
      robots: settings.seoNoindex === "true" ? "noindex,nofollow" : undefined,
    },
    ...(adminBar ? { adminBar } : {}),
  };
}

async function send(
  req: FastifyRequest,
  reply: FastifyReply,
  ctx: Record<string, unknown>,
  head: string,
  status = 200,
) {
  // Client-side navigation fetches the raw context as JSON (no full reload).
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, "__json")) {
    return reply.code(status).send(ctx);
  }
  if (!frontendBuilt()) {
    return reply.code(status).type("text/html").send(notBuiltPage());
  }
  const inject = ctx.adminBar ? renderAdminBarInjection(ctx.adminBar as AdminBarData) : {};
  const html = await renderPage(ctx, head, inject);
  return reply.code(status).type("text/html").send(html ?? notBuiltPage());
}

/** Render a single post/page. Canonical + edit URL come from the post's own path. */
async function renderSingle(
  req: FastifyRequest,
  reply: FastifyReply,
  base: BaseContext,
  post: PostDTO,
  view: "single" | "page",
) {
  const head = renderMetaTags(
    buildMeta({
      pageTitle: post.title,
      siteTitle: base.site.title,
      description: post.excerpt ?? base.seo.description,
      image: post.featuredMedia?.url ? base.site.baseUrl + post.featuredMedia.url : base.seo.ogImage,
      canonical: base.site.baseUrl + post.path,
      meta: post.meta,
      ...(view === "single" ? { ogType: "article" as const } : {}),
      separator: base.seo.separator,
      robots: base.seo.robots,
      category: post.terms.find((t) => t.taxonomy === "category")?.name,
    }),
  );
  return send(
    req,
    reply,
    {
      view,
      title: post.title,
      ...base,
      ...(base.adminBar
        ? { adminBar: { ...base.adminBar, editUrl: `/admin/content/${post.type}/${post.id}/edit` } }
        : {}),
      post,
    },
    head,
  );
}

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // Home
  app.get("/", async (req, reply) => {
    const base = await baseContext(app, req);
    const { items } = await listPublishedPosts(app.db, { limit: 12 });
    const head = renderMetaTags(
      buildMeta({
        pageTitle: base.site.tagline ? `${base.site.title} — ${base.site.tagline}` : base.site.title,
        tagline: base.site.tagline,
        description: base.seo.description,
        image: base.seo.ogImage,
        canonical: base.site.baseUrl + "/",
        robots: base.seo.robots,
      }),
    );
    return send(req, reply, { view: "home", title: base.site.title, ...base, posts: items }, head);
  });

  // Two-segment URLs are generic: /:route/:slug resolves to a single post of a
  // post type whose route is :route (e.g. /blog/hello, /products/widget), or
  // falls back to a taxonomy archive (e.g. /category/news, /tag/launch).
  app.get("/:route/:slug", async (req, reply) => {
    const base = await baseContext(app, req);
    const { route, slug } = req.params as { route: string; slug: string };

    // 1) Single post of a post type mounted at this route.
    const postType = route ? await getPostTypeByRoute(app.db, route) : undefined;
    if (postType) {
      const post = await getPublishedBySlug(app.db, postType.slug, slug);
      if (!post) return render404(app, req, reply);
      return renderSingle(req, reply, base, post, "single");
    }

    // 2) Taxonomy archive at this route (category, tag, topic, …).
    const result = await listPublishedByTerm(app.db, route, slug);
    if (!result) {
      // 3) Nested page (e.g. /demo/page-1): a child page under a parent page.
      const nested = await getPublishedByPath(app.db, `/${route}/${slug}`);
      if (nested) return renderSingle(req, reply, base, nested, "page");
      return render404(app, req, reply);
    }
    const head = renderMetaTags(
      buildMeta({
        pageTitle: result.term.name,
        siteTitle: base.site.title,
        description: base.seo.description,
        canonical: `${base.site.baseUrl}/${route}/${result.term.slug}`,
        separator: base.seo.separator,
        robots: base.seo.robots,
      }),
    );
    return send(req, reply, {
      view: "archive",
      title: result.term.name,
      ...base,
      posts: result.items,
      archive: { label: result.taxonomyLabel, name: result.term.name, slug: result.term.slug },
    }, head);
  });

  // sitemap + robots
  app.get("/sitemap.xml", async (req, reply) => {
    const base = await baseContext(app, req);
    const entries = (await listPublishedForSitemap(app.db)).map((e) => ({
      loc: `${base.site.baseUrl}${e.route ? `/${e.route}` : ""}/${e.slug}`,
      lastmod: e.updatedAt,
    }));
    entries.unshift({ loc: `${base.site.baseUrl}/`, lastmod: new Date().toISOString() });
    return reply.type("application/xml").send(generateSitemap(entries));
  });

  app.get("/robots.txt", async (req, reply) => {
    const base = await baseContext(app, req);
    return reply.type("text/plain").send(robotsTxt(base.site.baseUrl));
  });

  // Top-level single segment: a page of the type mounted at the root route ("").
  app.get("/:slug", async (req, reply) => {
    const base = await baseContext(app, req);
    const slug = (req.params as { slug: string }).slug;
    const rootType = await getPostTypeByRoute(app.db, "");
    if (!rootType) return render404(app, req, reply);
    const post = await getPublishedBySlug(app.db, rootType.slug, slug);
    // A child page's canonical URL is nested (/parent/child), so the bare slug 404s.
    if (!post || post.parentId) return render404(app, req, reply);
    return renderSingle(req, reply, base, post, "page");
  });

  // Deep nested pages (3+ segments, e.g. /a/b/c) resolve by full path.
  app.get("/*", async (req, reply) => {
    const base = await baseContext(app, req);
    const path = (req.params as { "*": string })["*"];
    const post = await getPublishedByPath(app.db, `/${path}`);
    if (!post) return render404(app, req, reply);
    return renderSingle(req, reply, base, post, "page");
  });
}

export async function render404(app: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {
  const base = await baseContext(app, req);
  const head = renderMetaTags(buildMeta({ pageTitle: "Not Found", siteTitle: base.site.title, meta: { robots: "noindex" } }));
  return send(req, reply, { view: "notfound", title: "Not Found", ...base }, head, 404);
}
