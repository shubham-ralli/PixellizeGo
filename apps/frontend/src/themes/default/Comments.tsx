import { useState } from "react";
import type { CommentView } from "../../types";
import { formatDate } from "./date";

type Status = "idle" | "sending" | "sent" | "error";

function CommentRow({ c }: { c: CommentView }) {
  return (
    <div className="comment">
      <div className={`comment__avatar${c.isStaff ? " comment__avatar--staff" : ""}`} aria-hidden="true">
        {c.authorName.trim()[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="comment__body">
        <div className="comment__head">
          <span className="comment__author">
            {c.authorUrl ? (
              <a href={c.authorUrl} rel="nofollow ugc noopener" target="_blank">
                {c.authorName}
              </a>
            ) : (
              c.authorName
            )}
          </span>
          {c.isStaff && <span className="comment__badge">Staff</span>}
          <span className="comment__date">{formatDate(c.createdAt)}</span>
        </div>
        <p className="comment__text">{c.content}</p>
      </div>
    </div>
  );
}

function CommentItem({ c, replies }: { c: CommentView; replies: CommentView[] }) {
  return (
    <li>
      <CommentRow c={c} />
      {replies.length > 0 && (
        <ul className="comment__replies">
          {replies.map((r) => (
            <li key={r.id}>
              <CommentRow c={r} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Comments({ postId, comments }: { postId: number; comments: CommentView[] }) {
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !authorEmail.trim() || !content.trim()) return;
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, authorName, authorEmail, content }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setMessage("Thanks! Your comment is awaiting moderation.");
      setAuthorName("");
      setAuthorEmail("");
      setContent("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="comments">
      <h2 className="comments__title">
        {comments.length > 0 ? `${comments.length} Comment${comments.length === 1 ? "" : "s"}` : "Comments"}
      </h2>

      {comments.length > 0 && (
        <ul className="comments__list">
          {comments
            .filter((c) => !c.parentId)
            .map((c) => (
              <CommentItem key={c.id} c={c} replies={comments.filter((r) => r.parentId === c.id)} />
            ))}
        </ul>
      )}

      <form className="comment-form" onSubmit={submit}>
        <h3 className="comment-form__title">Leave a comment</h3>
        {message && (
          <p className={status === "error" ? "comment-form__msg comment-form__msg--err" : "comment-form__msg comment-form__msg--ok"}>
            {message}
          </p>
        )}
        <div className="comment-form__row">
          <input
            className="comment-form__input"
            placeholder="Name"
            aria-label="Your name"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            required
          />
          <input
            className="comment-form__input"
            type="email"
            placeholder="Email (not published)"
            aria-label="Your email (not published)"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            required
          />
        </div>
        <textarea
          className="comment-form__input"
          rows={4}
          placeholder="Your comment…"
          aria-label="Your comment"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <button className="btn" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Post comment"}
        </button>
      </form>
    </section>
  );
}
