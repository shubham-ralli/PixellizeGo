import type { ListItemView, Pagination as PaginationData } from "@theme-api";
import { Pagination } from "./Pagination";
import { formatDate } from "./date";

export function Search({
  query,
  posts,
  pagination,
}: {
  query: string;
  posts: ListItemView[];
  pagination?: PaginationData;
}) {
  return (
    <>
      <header className="archive__header">
        <p className="muted">Search</p>
        <h1>{query ? `Results for “${query}”` : "Search"}</h1>
        <form className="search-page__form" action="/search" method="get">
          <input
            className="search-page__input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search posts…"
            aria-label="Search"
          />
          <button className="btn" type="submit">Search</button>
        </form>
      </header>

      {!query ? null : posts.length === 0 ? (
        <p className="muted" style={{ textAlign: "center" }}>
          No results found. Try different keywords.
        </p>
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

      {query && pagination && <Pagination data={pagination} />}
    </>
  );
}
