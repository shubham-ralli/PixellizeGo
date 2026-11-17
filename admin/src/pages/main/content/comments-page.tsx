import { type Column, DataTable } from "@/components/shared/data-table";
import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import {
  type AdminComment,
  type CommentStatus,
  bulkComments,
  deleteComment,
  listComments,
  replyComment,
  setCommentStatus,
} from "@/lib/cms-api";
import { useCallback, useEffect, useState } from "react";

const STATUS_STYLE: Record<CommentStatus, string> = {
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  approved: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  spam: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  trash: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
};

const TABS: { key: CommentStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "spam", label: "Spam" },
  { key: "trash", label: "Trash" },
];

export default function CommentsPage() {
  const [items, setItems] = useState<AdminComment[]>([]);
  const [filter, setFilter] = useState<CommentStatus | "">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return listComments(filter || undefined)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);
  useEffect(() => void load(), [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const openReply = (id: number) => {
    setReplyingId((cur) => (cur === id ? null : id));
    setReplyText("");
  };
  const sendReply = async (id: number) => {
    if (!replyText.trim()) return;
    setReplying(true);
    setError(null);
    try {
      await replyComment(id, replyText.trim());
      setReplyingId(null);
      setReplyText("");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setReplying(false);
    }
  };

  const runBulk = async (action: "approve" | "spam" | "trash" | "delete", ids: (string | number)[], clear: () => void) => {
    if (action === "delete" && !window.confirm(`Permanently delete ${ids.length} comment(s)?`)) return;
    await bulkComments(action, ids.map(Number));
    clear();
    void load();
  };

  const columns: Column<AdminComment>[] = [
    {
      key: "author",
      header: "Author",
      render: (c) => (
        <div>
          <p className="font-medium text-gray-800 dark:text-white/90">{c.authorName}</p>
          <p className="text-xs text-gray-400">{c.authorEmail}</p>
        </div>
      ),
    },
    {
      key: "comment",
      header: "Comment",
      render: (c) => (
        <div className="max-w-md">
          <div className="mb-0.5 flex items-center gap-2">
            {c.parentId && <span className="text-xs text-gray-400">↳ reply</span>}
            {c.isStaff && (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                staff
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{c.content}</p>
          {c.postTitle && <p className="mt-1 text-xs text-gray-400">on “{c.postTitle}”</p>}

          {/* Replies nested under this comment */}
          {items
            .filter((r) => r.parentId === c.id)
            .map((r) => (
              <div key={r.id} className="mt-3 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{r.authorName}</span>
                  {r.isStaff && (
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                      staff
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{r.content}</p>
                <div className="mt-1 flex gap-3">
                  {r.status !== "trash" && (
                    <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => act(() => setCommentStatus(r.id, "trash"))}>
                      Trash
                    </button>
                  )}
                  <button
                    className="text-xs text-red-500 hover:text-red-600"
                    onClick={() => window.confirm("Permanently delete this reply?") && act(() => deleteComment(r.id))}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

          {replyingId === c.id && (
            <div className="mt-2 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                placeholder="Write a reply…"
                className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
              />
              <div className="flex gap-2">
                <Button size="xs" disabled={replying} onClick={() => sendReply(c.id)}>
                  {replying ? "Sending…" : "Send reply"}
                </Button>
                <Button size="xs" variant="outline" onClick={() => setReplyingId(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[c.status]}`}>{c.status}</span>
      ),
    },
    { key: "date", header: "Date", render: (c) => <span className="text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (c) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="xs" variant="outline" onClick={() => openReply(c.id)}>Reply</Button>
          {c.status !== "approved" && (
            <Button size="xs" variant="outline" onClick={() => act(() => setCommentStatus(c.id, "approved"))}>Approve</Button>
          )}
          {c.status !== "pending" && (
            <Button size="xs" variant="outline" onClick={() => act(() => setCommentStatus(c.id, "pending"))}>Unapprove</Button>
          )}
          {c.status !== "spam" && (
            <Button size="xs" variant="outline" onClick={() => act(() => setCommentStatus(c.id, "spam"))}>Spam</Button>
          )}
          {c.status !== "trash" ? (
            <Button size="xs" variant="outline" onClick={() => act(() => setCommentStatus(c.id, "trash"))}>Trash</Button>
          ) : (
            <Button size="xs" variant="destructive" onClick={() => window.confirm("Permanently delete?") && act(() => deleteComment(c.id))}>Delete</Button>
          )}
        </div>
      ),
    },
  ];

  // Top-level rows; replies are shown nested inside their parent's cell. A reply whose
  // parent isn't in the current (status-filtered) set still shows as its own row.
  const topLevel = items.filter((c) => !c.parentId || !items.some((p) => p.id === c.parentId));

  return (
    <>
      <PageMeta title="Comments | Pixellize CMS" description="Moderate comments" />
      <h1 className="mb-5 text-title-sm font-semibold text-gray-800 dark:text-white/90">Comments</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={topLevel}
        rowKey={(c) => c.id}
        loading={loading}
        emptyText="No comments here."
        search={(c) => `${c.authorName} ${c.authorEmail} ${c.content} ${c.postTitle ?? ""}`}
        searchPlaceholder="Search comments…"
        selectable
        bulkActions={(ids, clear) => (
          <>
            <Button size="xs" variant="outline" onClick={() => runBulk("approve", ids, clear)}>Approve</Button>
            <Button size="xs" variant="outline" onClick={() => runBulk("spam", ids, clear)}>Spam</Button>
            <Button size="xs" variant="outline" onClick={() => runBulk("trash", ids, clear)}>Trash</Button>
            <Button size="xs" variant="destructive" onClick={() => runBulk("delete", ids, clear)}>Delete</Button>
          </>
        )}
        toolbarLeft={
          <div className="flex flex-wrap gap-4 text-sm">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={filter === t.key ? "font-medium text-brand-600 dark:text-brand-400" : "text-gray-500"}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />
    </>
  );
}
