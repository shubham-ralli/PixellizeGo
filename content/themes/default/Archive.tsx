import type { ListItemView, Pagination as PaginationData } from "@theme-api";
import { Pagination } from "./Pagination";
import { formatDate } from "./date";

export function Archive({
  archive,
  posts,
  pagination,
}: {
  archive: { label: string; name: string; slug: string };
  posts: ListItemView[];
  pagination?: PaginationData;
}) {
  return (
    <>
      <header className="archive__header">
        <p className="muted">{archive.label}</p>
        <h1>{archive.name}</h1>
      </header>

      {posts.length === 0 ? (
        <p className="muted" style={{ textAlign: "center" }}>Nothing here yet.</p>
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
                {p.excerpt && <p className="post-card__excerpt">{p.excerpt}</p>}
                <p className="post-card__meta">
                  {p.authorName ? `${p.authorName} · ` : ""}
                  {formatDate(p.publishedAt)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {pagination && <Pagination data={pagination} />}
    </>
  );
}
