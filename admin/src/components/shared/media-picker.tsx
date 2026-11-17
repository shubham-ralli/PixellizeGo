import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type MediaItem, deleteMedia, listMedia, updateMediaAlt, uploadMedia } from "@/lib/cms-api";
import { useEffect, useMemo, useRef, useState } from "react";

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
  imagesOnly?: boolean;
  title?: string;
  confirmLabel?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  imagesOnly = true,
  title = "Select media",
  confirmLabel = "Select",
}: MediaPickerProps) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image">(imagesOnly ? "image" : "all");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () =>
    listMedia({ limit: 100 })
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedId(null);
    setTab("library");
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = useMemo(() => items.find((m) => m.id === selectedId) ?? null, [items, selectedId]);
  useEffect(() => setAlt(selected?.altText ?? ""), [selected]);

  const visible = useMemo(
    () =>
      items.filter((m) => {
        if (typeFilter === "image" && !m.mimeType.startsWith("image/")) return false;
        if (search && !m.originalName.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [items, typeFilter, search],
  );

  if (!open) return null;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      let last: MediaItem | null = null;
      for (const f of Array.from(files)) last = await uploadMedia(f);
      await load();
      if (last) {
        setSelectedId(last.id);
        setTab("library");
      }
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

  const removeSelected = async () => {
    if (!selected || !window.confirm("Delete this file permanently?")) return;
    await deleteMedia(selected.id);
    setSelectedId(null);
    await load();
  };

  const confirm = () => {
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  const isImage = (m: MediaItem) => m.mimeType.startsWith("image/");

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/50 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200 px-6 dark:border-gray-800">
          {(["upload", "library"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 py-3 text-sm font-medium ${
                tab === t
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              {t === "upload" ? "Upload files" : "Media Library"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {tab === "upload" ? (
            <div
              className={`m-6 flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed text-center ${
                drag ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-300 dark:border-gray-700"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void onFiles(e.dataTransfer.files);
              }}
            >
              <p className="text-lg font-medium text-gray-700 dark:text-gray-200">Drop files to upload</p>
              <p className="my-3 text-sm text-gray-400">or</p>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={imagesOnly ? "image/*" : "image/*,application/pdf"}
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              <Button disabled={busy} onClick={() => fileInput.current?.click()}>
                {busy ? "Uploading…" : "Select Files"}
              </Button>
            </div>
          ) : (
            <>
              {/* Grid column */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-3 px-6 py-3">
                  {!imagesOnly && (
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as "all" | "image")}
                      className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                    >
                      <option value="all">All media</option>
                      <option value="image">Images</option>
                    </select>
                  )}
                  <Input
                    placeholder="Search media…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 max-w-xs"
                  />
                </div>

                <div className="grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-auto px-6 pb-6 sm:grid-cols-4 lg:grid-cols-5">
                  {visible.length === 0 ? (
                    <p className="col-span-full py-12 text-center text-sm text-gray-400">No media found.</p>
                  ) : (
                    visible.map((m) => {
                      const active = m.id === selectedId;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedId(m.id)}
                          onDoubleClick={() => {
                            setSelectedId(m.id);
                            onSelect(m);
                            onClose();
                          }}
                          title={m.originalName}
                          className={`group relative overflow-hidden rounded-lg border text-left ${
                            active ? "border-brand-500 ring-2 ring-brand-500" : "border-gray-200 dark:border-gray-800"
                          }`}
                        >
                          {active && (
                            <span className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-brand-500 text-white">
                              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          )}
                          <div className="flex aspect-square items-center justify-center bg-gray-50 dark:bg-white/5">
                            {isImage(m) ? (
                              <img src={m.thumbnailUrl ?? m.url} alt={m.altText ?? m.originalName} className="h-full w-full object-cover" />
                            ) : (
                              <span className="px-2 text-center text-[10px] text-gray-500">{m.mimeType}</span>
                            )}
                          </div>
                          <div className="truncate px-2 py-1 text-xs text-gray-600 dark:text-gray-400">
                            {m.originalName}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Details sidebar */}
              {selected && (
                <div className="w-72 shrink-0 overflow-auto border-l border-gray-200 p-5 dark:border-gray-800">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Attachment details</p>
                  <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gray-50 dark:bg-white/5">
                    {isImage(selected) ? (
                      <img src={selected.url} alt={selected.altText ?? ""} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-sm text-gray-500">{selected.mimeType}</span>
                    )}
                  </div>
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

                  <button onClick={removeSelected} className="mt-4 text-sm text-red-500 hover:underline">
                    Delete permanently
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selected}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
