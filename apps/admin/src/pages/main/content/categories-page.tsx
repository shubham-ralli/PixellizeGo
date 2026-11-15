import { type Column, DataTable } from "@/components/shared/data-table";
import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Category, createCategory, deleteCategory, listCategories, updateCategory } from "@/lib/cms-api";
import { useEffect, useState } from "react";

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    listCategories().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => void load(), []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setDescription("");
  };

  const submit = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      const body = { name, slug: slug.trim() || undefined, description: description || null };
      if (editingId) await updateCategory(editingId, body);
      else await createCategory(body);
      reset();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const edit = (c: Category) => {
    setEditingId(c.id);
    setName(c.name);
    setSlug(c.slug);
    setDescription(c.description ?? "");
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this category?")) return;
    await deleteCategory(id);
    void load();
  };

  const bulkDelete = async (ids: (string | number)[], clear: () => void) => {
    if (!window.confirm(`Delete ${ids.length} categor(ies)?`)) return;
    for (const id of ids) await deleteCategory(Number(id));
    clear();
    void load();
  };

  const columns: Column<Category>[] = [
    { key: "name", header: "Name", render: (c) => <span className="font-medium text-gray-800 dark:text-white/90">{c.name}</span> },
    { key: "slug", header: "Slug", render: (c) => <span className="text-gray-400">/{c.slug}</span> },
    { key: "postCount", header: "Posts" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (c) => (
        <div className="flex justify-end gap-2">
          <Button size="xs" variant="outline" onClick={() => edit(c)}>Edit</Button>
          <Button size="xs" variant="destructive" onClick={() => remove(c.id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Categories | Pixellize CMS" description="Manage categories" />
      <h1 className="mb-5 text-title-sm font-semibold text-gray-800 dark:text-white/90">Categories</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">{editingId ? "Edit category" : "Add category"}</h3>
          <div className="space-y-3">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Slug (optional — auto from name)" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
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
            rowKey={(c) => c.id}
            loading={loading}
            emptyText="No categories yet."
            search={(c) => `${c.name} ${c.slug}`}
            searchPlaceholder="Search categories…"
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
