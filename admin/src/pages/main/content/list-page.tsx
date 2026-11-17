import { type Column, DataTable } from "@/components/shared/data-table";
import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import {
  absoluteUrl,
  bulkPosts,
  // duplicatePost, // kept for later — Duplicate button temporarily hidden
  forceDeletePost,
  listPosts,
  listPostTypes,
  restorePost,
  trashPost,
  type PostListItem,
  type PostStatus,
  type PostTypeDef,
} from "@/lib/cms-api";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

const STATUS_STYLES: Record<PostStatus, string> = {
  published: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  draft: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
  scheduled: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
};

export default function ContentListPage() {
  const { type = "post" } = useParams();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const [items, setItems] = useState<PostListItem[]>([]);
  const [postType, setPostType] = useState<PostTypeDef | null>(null);
  const [status, setStatus] = useState<PostStatus | "">("");
  const [view, setView] = useState<"active" | "trash">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPostTypes().then((types) => setPostType(types.find((t) => t.slug === type) ?? null));
  }, [type]);

  const label = postType?.labelPlural ?? "Content";
  const singular = postType?.label ?? "Item";
  const base = `/content/${type}`;
  const isTrash = view === "trash";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPosts({
        type,
        status: isTrash ? undefined : status || undefined,
        search: q || undefined,
        trashed: isTrash,
        limit: 100,
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [type, status, isTrash, q]);

  useEffect(() => void load(), [load]);

  const rowAction = async (fn: () => Promise<unknown>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    await fn();
    void load();
  };

  const runBulk = async (action: "trash" | "restore" | "delete", ids: (string | number)[], clear: () => void) => {
    if (action === "delete" && !window.confirm(`Permanently delete ${ids.length} item(s)? This cannot be undone.`)) return;
    await bulkPosts(action, ids.map(Number));
    clear();
    void load();
  };

  const columns: Column<PostListItem>[] = [
    {
      key: "title",
      header: "Title",
      render: (p) => (
        <>
          {isTrash ? (
            <span className="font-medium text-gray-800 dark:text-white/90">{p.title}</span>
          ) : (
            <button className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90" onClick={() => navigate(`${base}/${p.id}/edit`)}>
              {p.title}
            </button>
          )}
          <div className="text-xs text-gray-400">/{p.slug}</div>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[p.status]}`}>{p.status}</span>,
    },
    { key: "author", header: "Author", render: (p) => p.authorName ?? "—" },
    { key: "updated", header: "Updated", render: (p) => <span className="text-gray-400">{new Date(p.updatedAt).toLocaleDateString()}</span> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-2">
          {isTrash ? (
            <>
              <Button size="xs" variant="outline" onClick={() => rowAction(() => restorePost(p.id))}>Restore</Button>
              <Button size="xs" variant="destructive" onClick={() => rowAction(() => forceDeletePost(p.id), "Permanently delete? This cannot be undone.")}>Delete</Button>
            </>
          ) : (
            <>
              <Button size="xs" variant="outline" onClick={() => window.open(absoluteUrl(p.path), "_blank", "noopener")}>View</Button>
              <Button size="xs" variant="outline" onClick={() => navigate(`${base}/${p.id}/edit`)}>Edit</Button>
              {/* Duplicate — hidden for now, kept for later:
              <Button size="xs" variant="outline" onClick={() => rowAction(async () => { const d = await duplicatePost(p.id); navigate(`${base}/${d.id}/edit`); })}>Duplicate</Button>
              */}
              <Button size="xs" variant="destructive" onClick={() => rowAction(() => trashPost(p.id))}>Trash</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const tabBtn = (v: "active" | "trash", text: string) => (
    <button onClick={() => setView(v)} className={view === v ? "font-medium text-brand-600 dark:text-brand-400" : "text-gray-500"}>
      {text}
    </button>
  );

  return (
    <>
      <PageMeta title={`${label} | Pixellize CMS`} description={`Manage ${label.toLowerCase()}`} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
          {label}
          {isTrash && <span className="ml-2 text-base font-normal text-gray-400">· Trash</span>}
          {q && (
            <span className="ml-2 text-base font-normal text-gray-400">
              · Search “{q}”{" "}
              <button
                className="text-sm text-brand-500 hover:underline"
                onClick={() => setSp((prev) => { prev.delete("q"); return prev; }, { replace: true })}
              >
                clear
              </button>
            </span>
          )}
        </h1>
        {!isTrash && <Button onClick={() => navigate(`${base}/new`)}>+ New {singular}</Button>}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(p) => p.id}
        loading={loading}
        emptyText={isTrash ? "Trash is empty." : `No ${label.toLowerCase()} yet.`}
        search={(p) => `${p.title} ${p.slug}`}
        searchPlaceholder={`Search ${label.toLowerCase()}…`}
        selectable
        bulkActions={(ids, clear) =>
          isTrash ? (
            <>
              <Button size="xs" variant="outline" onClick={() => runBulk("restore", ids, clear)}>Restore</Button>
              <Button size="xs" variant="destructive" onClick={() => runBulk("delete", ids, clear)}>Delete permanently</Button>
            </>
          ) : (
            <Button size="xs" variant="destructive" onClick={() => runBulk("trash", ids, clear)}>Move to Trash</Button>
          )
        }
        toolbarLeft={
          <>
            <div className="flex gap-4 text-sm">
              {tabBtn("active", "All")}
              {tabBtn("trash", "Trash")}
            </div>
            {!isTrash && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PostStatus | "")}
                className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
              </select>
            )}
          </>
        }
      />
    </>
  );
}
