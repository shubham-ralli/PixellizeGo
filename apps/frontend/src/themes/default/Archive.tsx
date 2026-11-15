import type { ListItemView } from "../../types";

export function Archive({
  archive,
  posts,
}: {
  archive: { kind: "category" | "tag"; name: string; slug: string };
  posts: ListItemView[];
}) {
  return (
    <>
      <header className="archive__header">
        <p className="muted">{archive.kind === "category" ? "Category" : "Tag"}</p>
        <h1>{archive.name}</h1>
      </header>

      {posts.length === 0 ? (
        <p className="muted">Nothing here yet.</p>
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
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
