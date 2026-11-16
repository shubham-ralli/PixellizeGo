import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { type Plugin, deletePlugin, listPlugins, setPluginActive, uploadPlugin } from "@/lib/cms-api";
import { useEffect, useRef, useState } from "react";

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => listPlugins().then(setPlugins).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  const toggle = async (p: Plugin) => {
    setBusy(p.slug);
    setError(null);
    try {
      await setPluginActive(p.slug, !p.isActive);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: Plugin) => {
    if (!confirm(`Delete plugin "${p.name}"? Its files will be removed.`)) return;
    setBusy(p.slug);
    setError(null);
    try {
      await deletePlugin(p.slug);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadPlugin(file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <PageMeta title="Plugins | Pixellize CMS" description="Manage plugins" />
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Plugins</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{plugins.length} installed</span>
          <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={onFile} />
          <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : "Upload plugin"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {plugins.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
          No plugins installed. Upload a <code>.zip</code> with a <code>/* Plugin Name: … */</code> header in its main file.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">Plugin</th>
                <th className="px-5 py-3 font-medium">Version</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {plugins.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 dark:text-white/90">{p.name}</span>
                      {p.isActive && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 dark:bg-green-500/10 dark:text-green-400">
                          Active
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="mt-1 max-w-xl text-gray-500 dark:text-gray-400">{p.description}</p>
                    )}
                    {p.author && <p className="mt-0.5 text-xs text-gray-400">By {p.author}</p>}
                  </td>
                  <td className="px-5 py-4 text-gray-500 dark:text-gray-400">v{p.version}</td>
                  <td className="px-5 py-4">
                    <span className={p.isActive ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                      {p.isActive ? "● Active" : "○ Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant={p.isActive ? "outline" : "default"}
                        disabled={busy === p.slug}
                        onClick={() => toggle(p)}
                      >
                        {busy === p.slug ? "…" : p.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === p.slug}
                        onClick={() => remove(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
