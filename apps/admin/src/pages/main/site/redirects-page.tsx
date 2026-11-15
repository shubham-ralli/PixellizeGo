import { type Column, DataTable } from "@/components/shared/data-table";
import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Redirect, createRedirect, deleteRedirect, listRedirects } from "@/lib/cms-api";
import { useEffect, useState } from "react";

export default function RedirectsPage() {
  const [items, setItems] = useState<Redirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [statusCode, setStatusCode] = useState<301 | 302>(301);
  const [error, setError] = useState<string | null>(null);

  const load = () => listRedirects().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => void load(), []);

  const add = async () => {
    if (!fromPath.trim() || !toPath.trim()) return;
    setError(null);
    try {
      await createRedirect({ fromPath: fromPath.trim(), toPath: toPath.trim(), statusCode });
      setFromPath("");
      setToPath("");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this redirect?")) return;
    await deleteRedirect(id);
    void load();
  };

  const bulkDelete = async (ids: (string | number)[], clear: () => void) => {
    if (!window.confirm(`Delete ${ids.length} redirect(s)?`)) return;
    for (const id of ids) await deleteRedirect(Number(id));
    clear();
    void load();
  };

  const columns: Column<Redirect>[] = [
    { key: "fromPath", header: "From", render: (r) => <span className="font-medium text-gray-800 dark:text-white/90">{r.fromPath}</span> },
    { key: "toPath", header: "To" },
    { key: "statusCode", header: "Type" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) => (
        <div className="flex justify-end">
          <Button size="xs" variant="destructive" onClick={() => remove(r.id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Redirects | Pixellize CMS" description="Manage URL redirects" />
      <h1 className="mb-5 text-title-sm font-semibold text-gray-800 dark:text-white/90">Redirects</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-5 w-full rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Add redirect</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs text-gray-500">From (e.g. /old-url)</label>
            <Input placeholder="/old-url" value={fromPath} onChange={(e) => setFromPath(e.target.value)} />
          </div>
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs text-gray-500">To (e.g. /new-url)</label>
            <Input placeholder="/new-url" value={toPath} onChange={(e) => setToPath(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Type</label>
            <select
              value={statusCode}
              onChange={(e) => setStatusCode(Number(e.target.value) as 301 | 302)}
              className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
            >
              <option value={301}>301 (permanent)</option>
              <option value={302}>302 (temporary)</option>
            </select>
          </div>
          <Button onClick={add}>Add</Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No redirects yet."
        search={(r) => `${r.fromPath} ${r.toPath}`}
        searchPlaceholder="Search redirects…"
        selectable
        bulkActions={(ids, clear) => (
          <Button size="xs" variant="destructive" onClick={() => bulkDelete(ids, clear)}>Delete</Button>
        )}
      />
    </>
  );
}
