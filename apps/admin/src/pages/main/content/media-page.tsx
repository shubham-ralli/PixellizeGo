import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type MediaItem, deleteMedia, listMedia, updateMediaAlt, uploadMedia } from "@/lib/cms-api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [alt, setAlt] = useState("");
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"" | "image" | "document">("");
  const [search, setSearch] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedId = params.get("item");
  const selected = items.find((m) => String(m.id) === selectedId) ?? null;

  const load = useCallback(
    () =>
      listMedia({ limit: 100, type: filter || undefined })
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
          setChecked(new Set());
        })
        .catch((e) => setError(e.message)),
    [filter],
  );
  useEffect(() => void load(), [load]);

  const visible = items.filter(
    (m) => !search || m.originalName.toLowerCase().includes(search.toLowerCase()),
  );
  useEffect(() => {
    setAlt(selected?.altText ?? "");
    setCopied(false);
  }, [selected]);

  const open = (m: MediaItem) => setParams({ item: String(m.id) }, { replace: false });
  const close = () => setParams({}, { replace: false });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) await uploadMedia(f);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const saveAlt = async () => {
    if (!selected || alt === (selected.altText ?? "")) return;
    await updateMediaAlt(selected.id, alt);
    setItems((prev) => prev.map((m) => (m.id === selected.id ? { ...m, altText: alt } : m)));
  };

  const remove = async () => {
    if (!selected || !window.confirm("Delete this file permanently?")) return;
    await deleteMedia(selected.id);
    close();
    await load();
  };

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allChecked = items.length > 0 && checked.size === items.length;
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(items.map((m) => m.id)));

  const bulkDelete = async () => {
    if (checked.size === 0 || !window.confirm(`Delete ${checked.size} file(s) permanently? This cannot be undone.`)) return;
    setError(null);
    try {
      for (const id of checked) await deleteMedia(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const copyUrl = async () => {
    if (!selected) return;
    const abs = window.location.origin + selected.url;
    try {
      await navigator.clipboard.writeText(abs);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const isImage = (m: MediaItem) => m.mimeType.startsWith("image/");

  return (
    <>
      <PageMeta title="Media Library | Pixellize CMS" description="Manage media" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Media Library</h1>
        <div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button disabled={busy} onClick={() => fileInput.current?.click()}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          {([
            ["", "All"],
            ["image", "Images"],
            ["document", "Documents"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={filter === v ? "font-medium text-brand-600 dark:text-brand-400" : "text-gray-500"}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search media…"
          aria-label="Search media"
          className="h-9 w-56 text-sm"
        />
      </div>

      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} /> Select all
          </label>
          {checked.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm dark:border-brand-500/30 dark:bg-brand-500/10">
              <span className="text-gray-600 dark:text-gray-300">{checked.size} selected</span>
              <Button size="xs" variant="destructive" onClick={bulkDelete}>Delete</Button>
            </div>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center text-gray-400 dark:border-gray-700">
          {items.length === 0 ? "No media yet. Click Upload to add files." : "No media matches your filter."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {visible.map((m) => (
            <div
              key={m.id}
              className={`group relative overflow-hidden rounded-xl border bg-white dark:bg-white/3 ${
                checked.has(m.id) ? "border-brand-500 ring-2 ring-brand-500" : "border-gray-200 hover:border-brand-500 dark:border-gray-800"
              }`}
            >
              <input
                type="checkbox"
                checked={checked.has(m.id)}
                onChange={() => toggle(m.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${m.originalName}`}
                className="absolute left-2 top-2 z-10 size-4 cursor-pointer"
              />
              <button onClick={() => open(m)} className="block w-full text-left">
                <div className="flex aspect-square items-center justify-center bg-gray-50 dark:bg-white/5">
                  {isImage(m) ? (
                    <img src={m.thumbnailUrl ?? m.url} alt={m.altText ?? m.originalName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-2 text-center text-xs text-gray-500">{m.mimeType}</span>
                  )}
                </div>
                <div className="truncate px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400">{m.originalName}</div>
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">{total} files</p>

      {/* Attachment details modal (deep-linked via ?item=<id>) */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/50 p-3 sm:p-6" onClick={close}>
          <div
            className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Attachment details</h2>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-auto p-6 md:grid-cols-[1.4fr_1fr]">
              <div className="flex items-center justify-center rounded-xl bg-gray-50 p-3 dark:bg-white/5">
                {isImage(selected) ? (
                  <img src={selected.url} alt={selected.altText ?? ""} className="max-h-[55vh] max-w-full rounded-lg object-contain" />
                ) : (
                  <a href={selected.url} target="_blank" rel="noopener" className="text-sm text-brand-500 underline">
                    Open {selected.mimeType} file
                  </a>
                )}
              </div>

              <div>
                <p className="break-all text-sm font-medium text-gray-800 dark:text-white/90">{selected.originalName}</p>
                <p className="mt-1 text-xs text-gray-400">{formatDate(selected.createdAt)}</p>
                <p className="text-xs text-gray-400">
                  {formatSize(selected.size)}
                  {selected.width && selected.height ? ` · ${selected.width}×${selected.height}` : ""}
                </p>

                <label className="mb-1 mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">Alt text</label>
                <textarea
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  onBlur={saveAlt}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                />

                <label className="mb-1 mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">File URL</label>
                <div className="flex gap-2">
                  <Input readOnly value={selected.url} onFocus={(e) => e.currentTarget.select()} className="h-9 text-xs" />
                  <Button size="sm" variant="outline" onClick={copyUrl}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>

                <button onClick={remove} className="mt-5 text-sm text-red-500 hover:underline">
                  Delete permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
