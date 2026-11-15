import type { PostView } from "../../types";

export function Page({ post }: { post: PostView }) {
  return (
    <article className="single">
      <header className="single__header">
        <h1>{post.title}</h1>
      </header>

      {post.featuredMedia && (
        <img className="single__featured" src={post.featuredMedia.url} alt={post.featuredMedia.altText ?? post.title} />
      )}

      <div className="prose" dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />
    </article>
  );
}
