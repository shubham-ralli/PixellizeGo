import { type Database, comments, posts } from "@pixellize/database";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export type CommentStatus = "pending" | "approved" | "spam" | "trash";

export class CommentError extends Error {
  code: "NOT_FOUND" | "INVALID";
  constructor(code: CommentError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "CommentError";
  }
}

export interface PublicComment {
  id: number;
  parentId: number | null;
  authorName: string;
  authorUrl: string | null;
  content: string;
  isStaff: boolean;
  createdAt: string;
}

export interface AdminComment {
  id: number;
  postId: number;
  parentId: number | null;
  postTitle: string | null;
  postType: string | null;
  authorName: string;
  authorEmail: string;
  authorUrl: string | null;
  content: string;
  isStaff: boolean;
  status: CommentStatus;
  createdAt: string;
}

/** Submit a visitor comment. Only allowed on a published, non-deleted post; starts pending. */
export async function createComment(
  db: Database,
  input: { postId: number; authorName: string; authorEmail: string; authorUrl?: string | null; content: string },
): Promise<void> {
  const post = (
    await db
      .select({ status: posts.status, deletedAt: posts.deletedAt })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .limit(1)
  )[0];
  if (!post || post.status !== "published" || post.deletedAt) {
    throw new CommentError("NOT_FOUND", "Post not found or not open for comments.");
  }
  await db.insert(comments).values({
    postId: input.postId,
    authorName: input.authorName.trim(),
    authorEmail: input.authorEmail.trim().toLowerCase(),
    authorUrl: input.authorUrl?.trim() || null,
    content: input.content.trim(),
    status: "pending",
  });
}

/** An admin reply to an existing comment — inherits the post, auto-approved, marked staff. */
export async function createReply(
  db: Database,
  parentId: number,
  input: { authorName: string; authorEmail: string; content: string },
): Promise<void> {
  const parent = (
    await db
      .select({ postId: comments.postId, status: comments.status })
      .from(comments)
      .where(eq(comments.id, parentId))
      .limit(1)
  )[0];
  if (!parent) throw new CommentError("NOT_FOUND", "Comment not found.");
  // Replying to a pending comment approves it, so the thread is visible together.
  if (parent.status === "pending") {
    await db.update(comments).set({ status: "approved" }).where(eq(comments.id, parentId));
  }
  await db.insert(comments).values({
    postId: parent.postId,
    parentId,
    authorName: input.authorName.trim(),
    authorEmail: input.authorEmail.trim().toLowerCase(),
    content: input.content.trim(),
    isStaff: true,
    status: "approved",
  });
}

/** Approved comments for a post, oldest first (public rendering). */
export async function listApprovedForPost(db: Database, postId: number): Promise<PublicComment[]> {
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      authorName: comments.authorName,
      authorUrl: comments.authorUrl,
      content: comments.content,
      isStaff: comments.isStaff,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(and(eq(comments.postId, postId), eq(comments.status, "approved")))
    .orderBy(comments.createdAt);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Count of pending comments — for the admin badge. */
export async function countPending(db: Database): Promise<number> {
  const row = (
    await db.select({ c: sql<number>`count(*)` }).from(comments).where(eq(comments.status, "pending"))
  )[0];
  return Number(row?.c ?? 0);
}

/** Moderation list, filtered by status, with the post title. */
export async function listCommentsAdmin(
  db: Database,
  filter: { status?: CommentStatus; limit?: number; offset?: number } = {},
): Promise<{ items: AdminComment[]; total: number }> {
  const cond = filter.status ? eq(comments.status, filter.status) : undefined;
  const limit = Math.min(filter.limit ?? 100, 200);
  const offset = filter.offset ?? 0;

  const rows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      parentId: comments.parentId,
      postTitle: posts.title,
      postType: posts.type,
      authorName: comments.authorName,
      authorEmail: comments.authorEmail,
      authorUrl: comments.authorUrl,
      content: comments.content,
      isStaff: comments.isStaff,
      status: comments.status,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(posts, eq(comments.postId, posts.id))
    .where(cond)
    .orderBy(desc(comments.createdAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db.select({ id: comments.id }).from(comments).where(cond);
  return {
    items: rows.map((r) => ({
      ...r,
      status: r.status as CommentStatus,
      createdAt: r.createdAt.toISOString(),
    })),
    total: countRows.length,
  };
}

export async function setCommentStatus(db: Database, id: number, status: CommentStatus): Promise<void> {
  const res = await db.update(comments).set({ status }).where(eq(comments.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new CommentError("NOT_FOUND", "Comment not found.");
}

export async function deleteComment(db: Database, id: number): Promise<void> {
  const res = await db.delete(comments).where(eq(comments.id, id));
  const [header] = res as unknown as [{ affectedRows: number }];
  if (!header.affectedRows) throw new CommentError("NOT_FOUND", "Comment not found.");
}

export async function bulkComments(
  db: Database,
  action: "approve" | "spam" | "trash" | "delete",
  ids: number[],
): Promise<number> {
  if (ids.length === 0) return 0;
  if (action === "delete") {
    const res = await db.delete(comments).where(inArray(comments.id, ids));
    return Number((res as unknown as [{ affectedRows: number }])[0].affectedRows ?? 0);
  }
  const status: CommentStatus = action === "approve" ? "approved" : action;
  const res = await db.update(comments).set({ status }).where(inArray(comments.id, ids));
  return Number((res as unknown as [{ affectedRows: number }])[0].affectedRows ?? 0);
}
