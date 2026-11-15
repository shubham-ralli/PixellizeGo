import { MediaPicker } from "@/components/shared/media-picker";
import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSettings, saveSettings } from "@/lib/cms-api";
import { useEffect, useState } from "react";

export default function SeoPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    getSettings().then(setValues).catch((e) => setError(e.message));
  }, []);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setStatus(null);
    setError(null);
    try {
      await saveSettings({
        seoMetaDescription: values.seoMetaDescription ?? "",
        seoTitleSeparator: values.seoTitleSeparator ?? "—",
        seoNoindex: values.seoNoindex === "true" ? "true" : "false",
        seoDefaultOgImage: values.seoDefaultOgImage ?? "",
      });
      setStatus("Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <>
      <PageMeta title="SEO | Pixellize CMS" description="SEO defaults" />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">SEO</h1>
        <span className="text-xs text-gray-400">{status}</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="max-w-xl space-y-5 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Default meta description
          </label>
          <textarea
            rows={3}
            value={values.seoMetaDescription ?? ""}
            onChange={(e) => set("seoMetaDescription", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
            placeholder="Used when a post/page has no description."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Title separator</label>
          <Input
            value={values.seoTitleSeparator ?? "—"}
            onChange={(e) => set("seoTitleSeparator", e.target.value)}
            className="max-w-24"
          />
          <p className="mt-1 text-xs text-gray-400">e.g. “Page {values.seoTitleSeparator || "—"} Site”</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Default social image (Open Graph)
          </label>
          {values.seoDefaultOgImage ? (
            <div className="flex items-center gap-3">
              <img src={values.seoDefaultOgImage} alt="og" className="h-16 rounded-lg border border-gray-200 dark:border-gray-800" />
              <Button size="xs" variant="outline" onClick={() => setPickerOpen(true)}>Change</Button>
              <Button size="xs" variant="outline" onClick={() => set("seoDefaultOgImage", "")}>Remove</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>Choose image</Button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={values.seoNoindex === "true"}
            onChange={(e) => set("seoNoindex", e.target.checked ? "true" : "false")}
          />
          Discourage search engines from indexing this site (adds <code className="mx-1">noindex</code>)
        </label>

        <Button onClick={save}>Save SEO settings</Button>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(m) => set("seoDefaultOgImage", m.url)}
        title="Default social image"
        confirmLabel="Use image"
      />
    </>
  );
}
