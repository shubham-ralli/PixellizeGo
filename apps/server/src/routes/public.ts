import {
  getPublishedBySlug,
  listPublishedByTaxonomy,
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

interface BaseContext {
  site: { title: string; tagline: string; baseUrl: string };
  menu: { label: string; url: string }[];
  themeSettings: Record<string, unknown>;
  seo: SeoDefaults;
  adminBar?: AdminBar;
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
    newPostUrl: "/admin/posts/new",
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
    menu: (menuRow?.items ?? []).map((i) => ({ label: i.label, url: i.url })),
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

  // Single post
  app.get("/blog/:slug", async (req, reply) => {
    const base = await baseContext(app, req);
    const slug = (req.params as { slug: string }).slug;
    const post = await getPublishedBySlug(app.db, "post", slug);
    if (!post) return render404(app, req, reply);
    const head = renderMetaTags(
      buildMeta({
        pageTitle: post.title,
        siteTitle: base.site.title,
        description: post.excerpt ?? base.seo.description,
        image: post.featuredMedia?.url ? base.site.baseUrl + post.featuredMedia.url : base.seo.ogImage,
        canonical: `${base.site.baseUrl}/blog/${post.slug}`,
        meta: post.meta,
        ogType: "article",
        separator: base.seo.separator,
        robots: base.seo.robots,
      }),
    );
    return send(
      req,
      reply,
      {
        view: "single",
        title: post.title,
        ...base,
        ...(base.adminBar ? { adminBar: { ...base.adminBar, editUrl: `/admin/posts/${post.id}/edit` } } : {}),
        post,
      },
      head,
    );
  });

  // Category / tag archives
  for (const kind of ["category", "tag"] as const) {
    app.get(`/${kind}/:slug`, async (req, reply) => {
      const base = await baseContext(app, req);
      const slug = (req.params as { slug: string }).slug;
      const result = await listPublishedByTaxonomy(app.db, kind, slug);
      if (!result) return render404(app, req, reply);
      const head = renderMetaTags(
        buildMeta({
          pageTitle: result.term.name,
          siteTitle: base.site.title,
          description: base.seo.description,
          canonical: `${base.site.baseUrl}/${kind}/${result.term.slug}`,
          separator: base.seo.separator,
          robots: base.seo.robots,
        }),
      );
      return send(req, reply, {
        view: "archive",
        title: result.term.name,
        ...base,
        posts: result.items,
        archive: { kind, name: result.term.name, slug: result.term.slug },
      }, head);
    });
  }

  // sitemap + robots
  app.get("/sitemap.xml", async (req, reply) => {
    const base = await baseContext(app, req);
    const entries = (await listPublishedForSitemap(app.db)).map((e) => ({
      loc: `${base.site.baseUrl}${e.type === "page" ? "" : "/blog"}/${e.slug}`,
      lastmod: e.updatedAt,
    }));
    entries.unshift({ loc: `${base.site.baseUrl}/`, lastmod: new Date().toISOString() });
    return reply.type("application/xml").send(generateSitemap(entries));
  });

  app.get("/robots.txt", async (req, reply) => {
    const base = await baseContext(app, req);
    return reply.type("text/plain").send(robotsTxt(base.site.baseUrl));
  });

  // Page by top-level slug (must be registered last — matches any single segment)
  app.get("/:slug", async (req, reply) => {
    const base = await baseContext(app, req);
    const slug = (req.params as { slug: string }).slug;
    const post = await getPublishedBySlug(app.db, "page", slug);
    if (!post) return render404(app, req, reply);
    const head = renderMetaTags(
      buildMeta({
        pageTitle: post.title,
        siteTitle: base.site.title,
        description: post.excerpt ?? base.seo.description,
        image: base.seo.ogImage,
        canonical: `${base.site.baseUrl}/${post.slug}`,
        meta: post.meta,
        separator: base.seo.separator,
        robots: base.seo.robots,
      }),
    );
    return send(
      req,
      reply,
      {
        view: "page",
        title: post.title,
        ...base,
        ...(base.adminBar ? { adminBar: { ...base.adminBar, editUrl: `/admin/pages/${post.id}/edit` } } : {}),
        post,
      },
      head,
    );
  });
}

export async function render404(app: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {
  const base = await baseContext(app, req);
  const head = renderMetaTags(buildMeta({ pageTitle: "Not Found", siteTitle: base.site.title, meta: { robots: "noindex" } }));
  return send(req, reply, { view: "notfound", title: "Not Found", ...base }, head, 404);
}
