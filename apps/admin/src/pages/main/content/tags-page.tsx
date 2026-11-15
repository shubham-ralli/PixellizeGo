import { type Column, DataTable } from "@/components/shared/data-table";
import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Tag, createTag, deleteTag, listTags, updateTag } from "@/lib/cms-api";
import { useEffect, useState } from "react";

export default function TagsPage() {
  const [items, setItems] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => listTags().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => void load(), []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setSlug("");
  };

  const submit = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      const body = { name, slug: slug.trim() || undefined };
      if (editingId) await updateTag(editingId, body);
      else await createTag(body);
      reset();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this tag?")) return;
    await deleteTag(id);
    void load();
  };

  const bulkDelete = async (ids: (string | number)[], clear: () => void) => {
    if (!window.confirm(`Delete ${ids.length} tag(s)?`)) return;
    for (const id of ids) await deleteTag(Number(id));
    clear();
    void load();
  };

  const columns: Column<Tag>[] = [
    { key: "name", header: "Name", render: (t) => <span className="font-medium text-gray-800 dark:text-white/90">{t.name}</span> },
    { key: "slug", header: "Slug", render: (t) => <span className="text-gray-400">/{t.slug}</span> },
    { key: "postCount", header: "Posts" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (t) => (
        <div className="flex justify-end gap-2">
          <Button size="xs" variant="outline" onClick={() => { setEditingId(t.id); setName(t.name); setSlug(t.slug); }}>Edit</Button>
          <Button size="xs" variant="destructive" onClick={() => remove(t.id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Tags | Pixellize CMS" description="Manage tags" />
      <h1 className="mb-5 text-title-sm font-semibold text-gray-800 dark:text-white/90">Tags</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">{editingId ? "Edit tag" : "Add tag"}</h3>
          <div className="space-y-3">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            <Input placeholder="Slug (optional — auto from name)" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={submit}>{editingId ? "Update" : "Add"}</Button>
              {editingId && <Button variant="outline" onClick={reset}>Cancel</Button>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(t) => t.id}
            loading={loading}
            emptyText="No tags yet."
            search={(t) => `${t.name} ${t.slug}`}
            searchPlaceholder="Search tags…"
            selectable
            bulkActions={(ids, clear) => (
              <Button size="xs" variant="destructive" onClick={() => bulkDelete(ids, clear)}>Delete</Button>
            )}
          />
        </div>
      </div>
    </>
  );
}
