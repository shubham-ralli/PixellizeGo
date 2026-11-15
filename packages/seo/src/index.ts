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
}): SeoMeta {
  const m = input.meta ?? {};
  const sep = input.separator || "—";
  const title = m.metaTitle || (input.siteTitle ? `${input.pageTitle} ${sep} ${input.siteTitle}` : input.pageTitle);
  const description = m.metaDescription || input.description || input.tagline;
  return {
    title,
    description,
    canonical: m.canonicalUrl || input.canonical,
    ogTitle: m.ogTitle || m.metaTitle || input.pageTitle,
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

export function robotsTxt(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: ${base}/sitemap.xml\n`;
}
