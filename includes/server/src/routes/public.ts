import {
  type PostDTO,
  getPostTypeByRoute,
  getPublishedByPath,
  getPublishedById,
  getPublishedBySlug,
  searchPublished,
  listApprovedForPost,
  listPublishedByTerm,
  listPublishedForSitemap,
  listPublishedForFeed,
  countPublishedForSitemap,
  listPublishedPosts,
} from "@pixellize/content";
import {
  getActiveTheme,
  getMenuByLocation,
  getSettingsFor,
  SEO_SETTING_KEYS,
  SITE_SETTING_KEYS,
} from "@pixellize/theme-engine";
import { breadcrumbJsonLd, buildMeta, generateRss, generateSitemap, generateSitemapIndex, renderMetaTags, robotsTxt } from "@pixellize/seo";
import { validateSession } from "@pixellize/auth";
import { env } from "@pixellize/core/env";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { type AdminBarData, renderAdminBarInjection } from "../admin-bar.js";
import { frontendBuilt, notBuiltPage, renderPage } from "../frontend.js";

interface AdminBar {
  user: string;
  avatarUrl: string | null;
  dashboardUrl: string;
  newPostUrl: string;
  logoutUrl: string;
  profileUrl: string;
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

const PER_PAGE = 9;
const pageOf = (q: unknown): number => {
  const n = Number((q as { page?: string } | undefined)?.page);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
};
/** Pagination metadata passed to the theme. `query` is extra querystring (e.g. "q=foo"). */
function paginate(page: number, total: number, baseUrl: string, query = "", perPage = PER_PAGE) {
  return { page, totalPages: Math.max(1, Math.ceil(total / perPage)), baseUrl, query };
}

interface ReadingSettings {
  homepageType: string; // "posts" | "page"
  homepagePageId: number | null;
  postsPageId: number | null;
  perPage: number;
  feedItems: number;
  feedType: string; // "full" | "excerpt"
}

interface BaseContext {
  site: { title: string; tagline: string; baseUrl: string; logo: string; icon: string };
  menu: MenuNode[];
  footerMenu: MenuNode[];
  themeSettings: Record<string, unknown>;
  seo: SeoDefaults;
  reading: ReadingSettings;
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
    avatarUrl: session.user.avatarUrl ?? null,
    dashboardUrl: "/admin",
    newPostUrl: "/admin/content/post/new",
    logoutUrl: "/admin/logout",
    profileUrl: "/admin/profile",
    editUrl: null,
  };
}

async function baseContext(app: FastifyInstance, req: FastifyRequest): Promise<BaseContext> {
  const settings = await getSettingsFor(app.db, [...SITE_SETTING_KEYS, ...SEO_SETTING_KEYS]);
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const baseUrl = (settings.siteUrl || `${proto}://${req.headers.host}`).replace(/\/$/, "");
  const [menuRow, footerRow] = await Promise.all([
    getMenuByLocation(app.db, "primary"),
    getMenuByLocation(app.db, "footer"),
  ]);
  const theme = await getActiveTheme(app.db);
  const adminBar = await resolveAdminBar(app, req);
  return {
    site: {
      title: settings.siteTitle || "Pixellize",
      tagline: settings.tagline || "",
      baseUrl,
      logo: settings.siteLogo || "",
      icon: settings.siteIcon || "",
    },
    menu: mapMenu(menuRow?.items ?? []),
    footerMenu: mapMenu(footerRow?.items ?? []),
    themeSettings: (theme?.settings as Record<string, unknown>) ?? {},
    seo: {
      description: settings.seoMetaDescription || undefined,
      ogImage: settings.seoDefaultOgImage ? baseUrl + settings.seoDefaultOgImage : undefined,
      separator: settings.seoTitleSeparator || "—",
      robots: settings.seoNoindex === "true" ? "noindex,nofollow" : undefined,
    },
    reading: {
      homepageType: settings.homepageType || "posts",
      homepagePageId: settings.homepagePageId ? Number(settings.homepagePageId) : null,
      postsPageId: settings.postsPageId ? Number(settings.postsPageId) : null,
      perPage: Math.min(Math.max(Number(settings.postsPerPage) || 9, 1), 50),
      feedItems: Math.min(Math.max(Number(settings.feedItems) || 10, 1), 50),
      feedType: settings.feedType || "excerpt",
    },
    ...(adminBar ? { adminBar } : {}),
  };
}

/** WordPress-style <body> classes based on the view and current post/page. */
function bodyClassFor(ctx: Record<string, unknown>): string {
  const view = ctx.view as string;
  const post = ctx.post as { id: number; type: string; slug: string } | undefined;
  const c: string[] = [];
  if (view === "home") c.push("home");
  else if (view === "search") c.push("search", "search-results");
  else if (view === "archive") c.push("archive");
  else if (view === "notfound") c.push("error404");
  else if (view === "page" && post) {
    // Pages: `page page-id-123 page-template-default type-page`
    c.push("page", `page-id-${post.id}`, "page-template-default", `type-page`, `page-${post.slug}`);
  } else if (view === "single" && post) {
    // Posts & custom types: `single single-post type-post post-id-123`
    c.push("single", `single-${post.type}`, `type-${post.type}`, `${post.type}-id-${post.id}`, `${post.type}-${post.slug}`);
    if (post.type === "post") c.push("post");
  }
  // sanitize to valid class tokens
  return c.join(" ").replace(/[^a-zA-Z0-9_ -]/g, "-");
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
  // A custom site icon (favicon) set in Settings is injected into every page head.
  const icon = (ctx.site as { icon?: string } | undefined)?.icon;
  const headWithIcon = icon ? `${head}\n    <link rel="icon" href="${icon.replace(/"/g, "&quot;")}" />` : head;
  const inject = ctx.adminBar ? renderAdminBarInjection(ctx.adminBar as AdminBarData) : {};
  const html = await renderPage(ctx, headWithIcon, { ...inject, bodyClass: bodyClassFor(ctx) });
  return reply.code(status).type("text/html").send(html ?? notBuiltPage());
}

/** Render a single post/page. Canonical + edit URL come from the post's own path. */
async function renderSingle(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
  base: BaseContext,
  post: PostDTO,
  view: "single" | "page",
) {
  const comments = await listApprovedForPost(app.db, post.id);
  const cat = post.terms.find((t) => t.taxonomy === "category");
  const crumbs = [{ name: "Home", url: base.site.baseUrl + "/" }];
  if (view === "single" && cat) crumbs.push({ name: cat.name, url: `${base.site.baseUrl}/${cat.route}/${cat.slug}` });
  crumbs.push({ name: post.title, url: base.site.baseUrl + post.path });
  const head =
    renderMetaTags(
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
        category: cat?.name,
      }),
    ) +
    "\n    " +
    breadcrumbJsonLd(crumbs);
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
      comments,
    },
    head,
  );
}

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // Home
  app.get("/", async (req, reply) => {
    const base = await baseContext(app, req);

    // Reading settings: a static page as the homepage, or the latest-posts feed.
    if (base.reading.homepageType === "page" && base.reading.homepagePageId) {
      const home = await getPublishedById(app.db, base.reading.homepagePageId);
      if (home) {
        const head = renderMetaTags(
          buildMeta({
            pageTitle: base.site.title,
            tagline: base.site.tagline,
            description: home.excerpt ?? base.seo.description,
            image: home.featuredMedia?.url ? base.site.baseUrl + home.featuredMedia.url : base.seo.ogImage,
            canonical: base.site.baseUrl + "/",
            robots: base.seo.robots,
          }),
        );
        return send(req, reply, { view: "page", title: base.site.title, ...base, post: home }, head);
      }
    }

    const perPage = base.reading.perPage;
    const page = pageOf(req.query);
    const { items, total } = await listPublishedPosts(app.db, { limit: perPage, offset: (page - 1) * perPage });
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
    return send(
      req,
      reply,
      { view: "home", title: base.site.title, ...base, posts: items, page, pagination: paginate(page, total, "/", "", perPage) },
      head,
    );
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
      return renderSingle(app, req, reply, base, post, "single");
    }

    // 2) Taxonomy archive at this route (category, tag, topic, …).
    const perPage = base.reading.perPage;
    const page = pageOf(req.query);
    const result = await listPublishedByTerm(app.db, route, slug, {
      limit: perPage,
      offset: (page - 1) * perPage,
    });
    if (!result) {
      // 3) Nested page (e.g. /demo/page-1): a child page under a parent page.
      const nested = await getPublishedByPath(app.db, `/${route}/${slug}`);
      if (nested) return renderSingle(app, req, reply, base, nested, "page");
      return render404(app, req, reply);
    }
    const head =
      renderMetaTags(
        buildMeta({
          pageTitle: result.term.name,
          siteTitle: base.site.title,
          description: base.seo.description,
          canonical: `${base.site.baseUrl}/${route}/${result.term.slug}`,
          separator: base.seo.separator,
          robots: base.seo.robots,
        }),
      ) +
      "\n    " +
      breadcrumbJsonLd([
        { name: "Home", url: base.site.baseUrl + "/" },
        { name: result.term.name, url: `${base.site.baseUrl}/${route}/${result.term.slug}` },
      ]);
    return send(req, reply, {
      view: "archive",
      title: result.term.name,
      ...base,
      posts: result.items,
      archive: { label: result.taxonomyLabel, name: result.term.name, slug: result.term.slug },
      pagination: paginate(page, result.total, `/${route}/${result.term.slug}`, "", perPage),
    }, head);
  });

  // Search results (static route — matched before the /:slug page catch-all).
  app.get("/search", async (req, reply) => {
    const base = await baseContext(app, req);
    const query = String((req.query as { q?: string }).q ?? "").slice(0, 120);
    const perPage = base.reading.perPage;
    const page = pageOf(req.query);
    const { items, total } = query
      ? await searchPublished(app.db, query, { limit: perPage, offset: (page - 1) * perPage })
      : { items: [], total: 0 };
    const head = renderMetaTags(
      buildMeta({
        pageTitle: query ? `Search: ${query}` : "Search",
        siteTitle: base.site.title,
        canonical: `${base.site.baseUrl}/search`,
        separator: base.seo.separator,
        meta: { robots: "noindex" },
      }),
    );
    return send(
      req,
      reply,
      {
        view: "search",
        title: "Search",
        ...base,
        posts: items,
        searchQuery: query,
        pagination: paginate(page, total, "/search", `q=${encodeURIComponent(query)}`, perPage),
      },
      head,
    );
  });

  // RSS feed — item count + full/excerpt controlled by Reading settings.
  app.get("/feed.xml", async (req, reply) => {
    const base = await baseContext(app, req);
    const rows = await listPublishedForFeed(app.db, base.reading.feedItems);
    const items = rows.map((r) => ({
      title: r.title,
      link: `${base.site.baseUrl}/blog/${r.slug}`,
      description: base.reading.feedType === "full" ? r.content ?? "" : r.excerpt ?? "",
      author: r.authorName ?? undefined,
      pubDate: r.publishedAt ?? undefined,
    }));
    const xml = generateRss(
      { title: base.site.title, link: base.site.baseUrl + "/", description: base.site.tagline || base.site.title },
      items,
    );
    return reply.type("application/rss+xml").send(xml);
  });

  // sitemap: an index of paginated sub-sitemaps once the site grows past SITEMAP_PAGE URLs.
  const SITEMAP_PAGE = 1000;

  app.get("/sitemap.xml", async (req, reply) => {
    const base = await baseContext(app, req);
    const total = await countPublishedForSitemap(app.db);
    // Small site → one sitemap with everything (plus the home page).
    if (total <= SITEMAP_PAGE) {
      const entries = (await listPublishedForSitemap(app.db)).map((e) => ({
        loc: `${base.site.baseUrl}${e.route ? `/${e.route}` : ""}/${e.slug}`,
        lastmod: e.updatedAt,
      }));
      entries.unshift({ loc: `${base.site.baseUrl}/`, lastmod: new Date().toISOString() });
      return reply.type("application/xml").send(generateSitemap(entries));
    }
    // Large site → a sitemap index.
    const pages = Math.ceil(total / SITEMAP_PAGE);
    const sitemaps = Array.from({ length: pages }, (_, i) => ({ loc: `${base.site.baseUrl}/sitemap-${i + 1}.xml` }));
    return reply.type("application/xml").send(generateSitemapIndex(sitemaps));
  });

  app.get("/sitemap-:n.xml", async (req, reply) => {
    const base = await baseContext(app, req);
    const n = Math.max(1, Number((req.params as { n: string }).n) || 1);
    const rows = await listPublishedForSitemap(app.db, { limit: SITEMAP_PAGE, offset: (n - 1) * SITEMAP_PAGE });
    if (rows.length === 0) return render404(app, req, reply);
    const entries = rows.map((e) => ({
      loc: `${base.site.baseUrl}${e.route ? `/${e.route}` : ""}/${e.slug}`,
      lastmod: e.updatedAt,
    }));
    if (n === 1) entries.unshift({ loc: `${base.site.baseUrl}/`, lastmod: new Date().toISOString() });
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

    // If this page is the configured "posts page", render the blog feed at its URL.
    if (base.reading.postsPageId && post.id === base.reading.postsPageId) {
      const perPage = base.reading.perPage;
      const page = pageOf(req.query);
      const { items, total } = await listPublishedPosts(app.db, { limit: perPage, offset: (page - 1) * perPage });
      const head = renderMetaTags(
        buildMeta({
          pageTitle: post.title,
          siteTitle: base.site.title,
          canonical: `${base.site.baseUrl}/${post.slug}`,
          separator: base.seo.separator,
          robots: base.seo.robots,
        }),
      );
      return send(req, reply, {
        view: "archive",
        title: post.title,
        ...base,
        posts: items,
        archive: { label: "Blog", name: post.title, slug: post.slug },
        pagination: paginate(page, total, `/${post.slug}`, "", perPage),
      }, head);
    }

    return renderSingle(app, req, reply, base, post, "page");
  });

  // Deep nested pages (3+ segments, e.g. /a/b/c) resolve by full path.
  app.get("/*", async (req, reply) => {
    const base = await baseContext(app, req);
    const path = (req.params as { "*": string })["*"];
    const post = await getPublishedByPath(app.db, `/${path}`);
    if (!post) return render404(app, req, reply);
    return renderSingle(app, req, reply, base, post, "page");
  });
}

export async function render404(app: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {
  const base = await baseContext(app, req);
  const head = renderMetaTags(buildMeta({ pageTitle: "Not Found", siteTitle: base.site.title, meta: { robots: "noindex" } }));
  return send(req, reply, { view: "notfound", title: "Not Found", ...base }, head, 404);
}
