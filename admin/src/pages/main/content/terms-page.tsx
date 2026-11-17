import { type Column, DataTable } from "@/components/shared/data-table";
import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Taxonomy,
  type Term,
  createTerm,
  deleteTerm,
  listTaxonomies,
  listTerms,
  updateTerm,
} from "@/lib/cms-api";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";

/** Generic term manager for any taxonomy (category, tag, or a future one). */
export default function TermsPage() {
  const { tax = "category" } = useParams();
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [items, setItems] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTaxonomies()
      .then((all) => setTaxonomy(all.find((t) => t.slug === tax) ?? null))
      .catch(() => {});
  }, [tax]);

  const load = useCallback(() => {
    setLoading(true);
    return listTerms(tax)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tax]);
  useEffect(() => {
    void load();
  }, [load]);

  const label = taxonomy?.label ?? "Term";
  const labelPlural = taxonomy?.labelPlural ?? "Terms";

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
      if (editingId) await updateTerm(editingId, body);
      else await createTerm(tax, body);
      reset();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const edit = (t: Term) => {
    setEditingId(t.id);
    setName(t.name);
    setSlug(t.slug);
    setDescription(t.description ?? "");
  };

  const remove = async (id: number) => {
    if (!window.confirm(`Delete this ${label.toLowerCase()}?`)) return;
    await deleteTerm(id);
    void load();
  };

  const bulkDelete = async (ids: (string | number)[], clear: () => void) => {
    if (!window.confirm(`Delete ${ids.length} item(s)?`)) return;
    for (const id of ids) await deleteTerm(Number(id));
    clear();
    void load();
  };

  const columns: Column<Term>[] = [
    { key: "name", header: "Name", render: (t) => <span className="font-medium text-gray-800 dark:text-white/90">{t.name}</span> },
    { key: "slug", header: "Slug", render: (t) => <span className="text-gray-400">/{t.slug}</span> },
    { key: "postCount", header: "Posts" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (t) => (
        <div className="flex justify-end gap-2">
          <Button size="xs" variant="outline" onClick={() => edit(t)}>Edit</Button>
          <Button size="xs" variant="destructive" onClick={() => remove(t.id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={`${labelPlural} | Pixellize CMS`} description={`Manage ${labelPlural.toLowerCase()}`} />
      <h1 className="mb-5 text-title-sm font-semibold text-gray-800 dark:text-white/90">{labelPlural}</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">
            {editingId ? `Edit ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
          </h3>
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
            rowKey={(t) => t.id}
            loading={loading}
            emptyText={`No ${labelPlural.toLowerCase()} yet.`}
            search={(t) => `${t.name} ${t.slug}`}
            searchPlaceholder={`Search ${labelPlural.toLowerCase()}…`}
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
