import type { ListItemView, SiteInfo } from "../../types";
import { formatDate } from "./date";

export function Home({ site, posts }: { site: SiteInfo; posts: ListItemView[] }) {
  return (
    <>
      <section className="hero">
        <h1>{site.title || "Pixellize"}</h1>
        {site.tagline && <p className="hero__tagline">{site.tagline}</p>}
      </section>

      {posts.length === 0 ? (
        <p className="muted">No posts published yet.</p>
      ) : (
        <div className="post-grid">
          {posts.map((p) => (
            <article key={p.id} className="post-card">
              {p.featuredUrl && (
                <a href={`/blog/${p.slug}`} className="post-card__media">
                  <img src={p.featuredUrl} alt={p.title} />
                </a>
              )}
              <div className="post-card__body">
                <h2>
                  <a href={`/blog/${p.slug}`}>{p.title}</a>
                </h2>
                {p.excerpt && <p className="muted">{p.excerpt}</p>}
                <p className="post-card__meta">
                  {p.authorName ? `${p.authorName} · ` : ""}
                  {formatDate(p.publishedAt)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
