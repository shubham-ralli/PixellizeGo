import type { ListItemView, Pagination as PaginationData, SiteInfo } from "../../types";
import { Pagination } from "./Pagination";
import { formatDate } from "./date";

function Card({ p }: { p: ListItemView }) {
  return (
    <article className="post-card">
      {p.featuredUrl && (
        <a href={`/blog/${p.slug}`} className="post-card__media">
          <img src={p.featuredUrl} alt={p.title} />
        </a>
      )}
      <div className="post-card__body">
        <h2>
          <a href={`/blog/${p.slug}`}>{p.title}</a>
        </h2>
        {p.excerpt && <p className="post-card__excerpt">{p.excerpt}</p>}
        <p className="post-card__meta">
          {p.authorName ? `${p.authorName} · ` : ""}
          {formatDate(p.publishedAt)}
        </p>
      </div>
    </article>
  );
}

export function Home({
  site,
  posts,
  page = 1,
  pagination,
}: {
  site: SiteInfo;
  posts: ListItemView[];
  page?: number;
  pagination?: PaginationData;
}) {
  const firstPage = page <= 1;
  // Only page 1 gets the hero + featured treatment; later pages are a plain grid.
  const [featured, ...rest] = firstPage ? posts : [undefined, ...posts];

  return (
    <>
      {firstPage ? (
        <section className="hero">
          <p className="hero__eyebrow">Welcome</p>
          <h1>{site.title || "Pixellize"}</h1>
          {site.tagline && <p className="hero__tagline">{site.tagline}</p>}
        </section>
      ) : (
        <header className="archive__header">
          <p className="muted">Blog</p>
          <h1>Page {page}</h1>
        </header>
      )}

      {posts.length === 0 ? (
        <p className="muted" style={{ textAlign: "center" }}>No posts published yet.</p>
      ) : (
        <>
          {firstPage && featured && (
            <section className="featured">
              {featured.featuredUrl && (
                <a href={`/blog/${featured.slug}`} className="featured__media">
                  <img src={featured.featuredUrl} alt={featured.title} />
                </a>
              )}
              <div>
                <span className="chip">Featured</span>
                <h2 className="featured__title">
                  <a href={`/blog/${featured.slug}`}>{featured.title}</a>
                </h2>
                {featured.excerpt && <p className="featured__excerpt">{featured.excerpt}</p>}
                <p className="featured__meta">
                  {featured.authorName ? `${featured.authorName} · ` : ""}
                  {formatDate(featured.publishedAt)}
                </p>
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              {firstPage && (
                <div className="section-head">
                  <h2>Latest stories</h2>
                </div>
              )}
              <div className="post-grid">
                {rest.filter((p): p is ListItemView => Boolean(p)).map((p) => (
                  <Card key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {pagination && <Pagination data={pagination} />}
    </>
  );
}
