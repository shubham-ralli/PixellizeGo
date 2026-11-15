import type { PostView } from "../../types";
import { formatDate } from "./date";

export function Single({ post }: { post: PostView }) {
  return (
    <article className="single">
      <header className="single__header">
        <h1>{post.title}</h1>
        <p className="single__meta">
          {post.author ? `${post.author.name} · ` : ""}
          {formatDate(post.publishedAt)}
        </p>
        {post.categories.length > 0 && (
          <p className="single__terms">
            {post.categories.map((c) => (
              <a key={c.slug} href={`/category/${c.slug}`} className="chip">
                {c.name}
              </a>
            ))}
          </p>
        )}
      </header>

      {post.featuredMedia && (
        <img className="single__featured" src={post.featuredMedia.url} alt={post.featuredMedia.altText ?? post.title} />
      )}

      <div className="prose" dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />

      {post.tags.length > 0 && (
        <footer className="single__tags">
          {post.tags.map((t) => (
            <a key={t.slug} href={`/tag/${t.slug}`} className="chip chip--tag">
              #{t.name}
            </a>
          ))}
        </footer>
      )}
    </article>
  );
}
