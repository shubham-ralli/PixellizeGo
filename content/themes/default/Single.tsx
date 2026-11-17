import type { CommentView, PostView } from "@theme-api";
import { Comments } from "./Comments";
import { formatDate } from "./date";

export function Single({ post, comments }: { post: PostView; comments: CommentView[] }) {
  const cats = post.terms.filter((t) => t.taxonomy !== "tag");
  const tags = post.terms.filter((t) => t.taxonomy === "tag");

  return (
    <article className="single single--wide">
      <header className="single__header">
        {cats.length > 0 && (
          <p className="single__terms">
            {cats.map((t) => (
              <a key={`${t.route}-${t.slug}`} href={`/${t.route}/${t.slug}`} className="chip">
                {t.name}
              </a>
            ))}
          </p>
        )}
        <h1>{post.title}</h1>
        <p className="single__meta">
          {post.author ? `By ${post.author.name} · ` : ""}
          {formatDate(post.publishedAt)}
        </p>
      </header>

      {post.featuredMedia && (
        <img className="single__featured" src={post.featuredMedia.url} alt={post.featuredMedia.altText ?? post.title} />
      )}

      <div className="single" style={{ maxWidth: "720px" }}>
        <div className="prose" dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />

        {tags.length > 0 && (
          <footer className="single__tags">
            {tags.map((t) => (
              <a key={`${t.route}-${t.slug}`} href={`/${t.route}/${t.slug}`} className="chip chip--tag">
                #{t.name}
              </a>
            ))}
          </footer>
        )}

        <Comments postId={post.id} comments={comments} />
      </div>
    </article>
  );
}
