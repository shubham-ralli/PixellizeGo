/** Replace %title% %sitename% %category% %sep% tokens with real values. */
export function resolveTokens(
  tpl: string,
  vars: { title?: string; sitename?: string; category?: string; sep?: string },
): string {
  return tpl
    .replace(/%title%/g, vars.title ?? "")
    .replace(/%sitename%/g, vars.sitename ?? "")
    .replace(/%category%/g, vars.category ?? "")
    .replace(/%sep%/g, vars.sep ?? "—")
    .replace(/\s{2,}/g, " ")
    .trim()
    // Drop a dangling separator left when a variable resolved to empty.
    .replace(/^[\s|·–—-]+|[\s|·–—-]+$/g, "")
    .trim();
}

/** Default SEO title template when a post/page has none. */
export const DEFAULT_TITLE_TEMPLATE = "%title% %sep% %sitename%";

export interface SeoMeta {
  title: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  robots?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Merge per-content meta over site defaults into a resolved SeoMeta. */
export function buildMeta(input: {
  pageTitle: string;
  siteTitle?: string;
  tagline?: string;
  description?: string;
  canonical?: string;
  image?: string;
  meta?: Record<string, string>; // post_meta (metaTitle, metaDescription, canonicalUrl, og*)
  ogType?: string;
  separator?: string; // title separator (default "—")
  robots?: string; // site-wide default (e.g. "noindex,nofollow")
  category?: string; // primary category (for %category% token)
}): SeoMeta {
  const m = input.meta ?? {};
  const sep = input.separator || "—";
  const vars = { title: input.pageTitle, sitename: input.siteTitle, category: input.category, sep };
  const defaultTpl = input.siteTitle ? DEFAULT_TITLE_TEMPLATE : "%title%";
  const title = resolveTokens(m.metaTitle || defaultTpl, vars);
  const description = m.metaDescription || input.description || input.tagline;
  return {
    title,
    description,
    canonical: m.canonicalUrl || input.canonical,
    ogTitle: resolveTokens(m.ogTitle || m.metaTitle || "%title%", vars),
    ogDescription: m.ogDescription || description,
    ogImage: m.ogImage || input.image,
    ogType: input.ogType ?? "website",
    robots: m.robots || input.robots,
  };
}

/** Render a SeoMeta object to <head> HTML. */
export function renderMetaTags(meta: SeoMeta): string {
  const tags: string[] = [`<title>${esc(meta.title)}</title>`];
  if (meta.description) tags.push(`<meta name="description" content="${esc(meta.description)}" />`);
  if (meta.robots) tags.push(`<meta name="robots" content="${esc(meta.robots)}" />`);
  if (meta.canonical) tags.push(`<link rel="canonical" href="${esc(meta.canonical)}" />`);
  tags.push(`<meta property="og:title" content="${esc(meta.ogTitle ?? meta.title)}" />`);
  if (meta.ogDescription) tags.push(`<meta property="og:description" content="${esc(meta.ogDescription)}" />`);
  tags.push(`<meta property="og:type" content="${esc(meta.ogType ?? "website")}" />`);
  if (meta.ogImage) tags.push(`<meta property="og:image" content="${esc(meta.ogImage)}" />`);
  if (meta.canonical) tags.push(`<meta property="og:url" content="${esc(meta.canonical)}" />`);
  tags.push(`<meta name="twitter:card" content="${meta.ogImage ? "summary_large_image" : "summary"}" />`);
  return tags.join("\n    ");
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string; // ISO
  changefreq?: string;
  priority?: number;
}

export function generateSitemap(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${esc(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod.slice(0, 10)}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority != null) parts.push(`    <priority>${e.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** A sitemap index that points to paginated sub-sitemaps (for large sites). */
export function generateSitemapIndex(sitemaps: { loc: string; lastmod?: string }[]): string {
  const items = sitemaps
    .map((s) => {
      const parts = [`    <loc>${esc(s.loc)}</loc>`];
      if (s.lastmod) parts.push(`    <lastmod>${s.lastmod.slice(0, 10)}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

/** BreadcrumbList JSON-LD (<script> tag) for a trail of {name, url}. */
export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]): string {
  if (crumbs.length === 0) return "";
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  author?: string;
  pubDate?: string; // ISO
}

/** A simple RSS 2.0 feed. */
export function generateRss(channel: { title: string; link: string; description: string }, items: FeedItem[]): string {
  const entries = items
    .map((i) => {
      const parts = [
        `      <title>${esc(i.title)}</title>`,
        `      <link>${esc(i.link)}</link>`,
        `      <guid>${esc(i.link)}</guid>`,
        `      <description><![CDATA[${i.description}]]></description>`,
      ];
      if (i.author) parts.push(`      <dc:creator>${esc(i.author)}</dc:creator>`);
      if (i.pubDate) parts.push(`      <pubDate>${new Date(i.pubDate).toUTCString()}</pubDate>`);
      return `    <item>\n${parts.join("\n")}\n    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${esc(channel.title)}</title>
    <link>${esc(channel.link)}</link>
    <description>${esc(channel.description)}</description>
${entries}
  </channel>
</rss>
`;
}

export function robotsTxt(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: ${base}/sitemap.xml\n`;
}
