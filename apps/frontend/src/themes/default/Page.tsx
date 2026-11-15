import type { PostView } from "../../types";

export function Page({ post }: { post: PostView }) {
  return (
    <article className="single">
      <header className="single__header">
        <h1>{post.title}</h1>
      </header>
      <div className="prose" dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />
    </article>
  );
}
