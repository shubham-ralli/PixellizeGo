import type { ListItemView, SiteInfo } from "../../types";
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

export function Home({ site, posts }: { site: SiteInfo; posts: ListItemView[] }) {
  const [featured, ...rest] = posts;

  return (
    <>
      <section className="hero">
        <p className="hero__eyebrow">Welcome</p>
        <h1>{site.title || "Pixellize"}</h1>
        {site.tagline && <p className="hero__tagline">{site.tagline}</p>}
      </section>

      {posts.length === 0 ? (
        <p className="muted" style={{ textAlign: "center" }}>No posts published yet.</p>
      ) : (
        <>
          {featured && (
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
              <div className="section-head">
                <h2>Latest stories</h2>
              </div>
              <div className="post-grid">
                {rest.map((p) => (
                  <Card key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
