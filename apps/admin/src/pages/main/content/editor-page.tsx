import { MediaPicker } from "@/components/shared/media-picker";
import { PageMeta } from "@/components/shared/page-meta";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  autosavePost,
  createPost,
  getPost,
  listCategories,
  listTags,
  type Category,
  type PostInput,
  type PostStatus,
  type PostType,
  type Tag,
  publicUrl,
  updatePost,
  uploadMedia,
} from "@/lib/cms-api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

const META_FIELDS: { key: string; label: string }[] = [
  { key: "metaTitle", label: "Meta Title" },
  { key: "metaDescription", label: "Meta Description" },
  { key: "canonicalUrl", label: "Canonical URL" },
  { key: "ogTitle", label: "OG Title" },
  { key: "ogDescription", label: "OG Description" },
  { key: "ogImage", label: "OG Image URL" },
];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{children}</label>;
}

export default function ContentEditorPage({ type }: { type: PostType }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const typeLabel = type === "post" ? "Post" : "Page";
  const base = type === "post" ? "/posts" : "/pages";

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<PostStatus>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [featured, setFeatured] = useState<{ id: number; url: string } | null>(null);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    void listCategories().then(setAllCategories);
    void listTags().then(setAllTags);
  }, []);

  useEffect(() => {
    if (!id) return;
    void getPost(Number(id)).then((p) => {
      setTitle(p.title);
      setSlug(p.slug);
      setExcerpt(p.excerpt ?? "");
      setContent(p.content ?? "");
      setStatus(p.status);
      setScheduledAt(p.scheduledAt ? p.scheduledAt.slice(0, 16) : "");
      setFeatured(p.featuredMedia ? { id: p.featuredMedia.id, url: p.featuredMedia.url } : null);
      setCategoryIds(p.categories.map((c) => c.id));
      setTagIds(p.tags.map((t) => t.id));
      setMeta(p.meta ?? {});
    });
  }, [id]);

  const buildBody = useCallback(
    (overrideStatus?: PostStatus): PostInput => ({
      type,
      title: title || "Untitled",
      slug: slug || undefined,
      excerpt: excerpt || null,
      content,
      status: overrideStatus ?? status,
      scheduledAt: (overrideStatus ?? status) === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      featuredMediaId: featured?.id ?? null,
      categoryIds,
      tagIds,
      meta,
    }),
    [type, title, slug, excerpt, content, status, scheduledAt, featured, categoryIds, tagIds, meta],
  );

  const save = async (overrideStatus?: PostStatus) => {
    setSaving(true);
    setError(null);
    try {
      const body = buildBody(overrideStatus);
      if (overrideStatus) setStatus(overrideStatus);
      if (isEdit) {
        await updatePost(Number(id), body);
      } else {
        const created = await createPost(body);
        navigate(`${base}/${created.id}/edit`, { replace: true });
      }
      dirty.current = false;
      setAutoStatus("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Autosave (existing posts only): 4s after last edit.
  useEffect(() => {
    if (!isEdit) return;
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      try {
        await autosavePost(Number(id), { title, content });
        setAutoStatus(`Autosaved ${new Date().toLocaleTimeString()}`);
        dirty.current = false;
      } catch {
        /* ignore transient autosave errors */
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [title, content, id, isEdit]);

  const markDirty = () => {
    dirty.current = true;
    setAutoStatus("Unsaved changes");
  };

  const onUploadFeatured = async (file: File) => {
    try {
      const m = await uploadMedia(file);
      setFeatured({ id: m.id, url: m.url });
      markDirty();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const toggle = (arr: number[], setArr: (v: number[]) => void, id: number) => {
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
    markDirty();
  };

  return (
    <>
      <PageMeta title={`${isEdit ? "Edit" : "New"} ${typeLabel} | Pixellize CMS`} description="" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate(base)} className="text-sm text-gray-500 hover:text-brand-500">
            ← {typeLabel}s
          </button>
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            {isEdit ? `Edit ${typeLabel}` : `New ${typeLabel}`}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{autoStatus}</span>
          {isEdit && slug && (
            <Button
              variant="outline"
              onClick={() => window.open(publicUrl(type, slug), "_blank", "noopener")}
            >
              Preview
            </Button>
          )}
          <Button variant="outline" disabled={saving} onClick={() => save("draft")}>
            Save Draft
          </Button>
          <Button disabled={saving} onClick={() => save("published")}>
            {saving ? "Saving…" : "Publish"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markDirty();
              }}
              placeholder={`${typeLabel} title`}
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => { setSlug(e.target.value); markDirty(); }} placeholder="auto-generated" />
          </div>
          <div>
            <Label>Content</Label>
            <RichTextEditor value={content} onChange={(html) => { setContent(html); markDirty(); }} />
          </div>
          <div>
            <Label>Excerpt</Label>
            <textarea
              value={excerpt}
              onChange={(e) => { setExcerpt(e.target.value); markDirty(); }}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">SEO & Open Graph</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {META_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input
                    value={meta[f.key] ?? ""}
                    onChange={(e) => { setMeta({ ...meta, [f.key]: e.target.value }); markDirty(); }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as PostStatus); markDirty(); }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </select>
            {status === "scheduled" && (
              <div className="mt-3">
                <Label>Publish at</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => { setScheduledAt(e.target.value); markDirty(); }}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <Label>Featured Image</Label>
            {featured ? (
              <div className="space-y-2">
                <img src={featured.url} alt="featured" className="w-full rounded-lg" />
                <div className="flex gap-2">
                  <Button size="xs" variant="outline" onClick={() => setPickerOpen(true)}>
                    Change
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => { setFeatured(null); markDirty(); }}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Button size="sm" variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
                  Choose from library
                </Button>
                <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 py-4 text-sm text-gray-500 dark:border-gray-700">
                  or upload new
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onUploadFeatured(e.target.files[0])}
                  />
                </label>
              </div>
            )}
          </div>

          {type === "post" && (
            <>
              <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                <Label>Categories</Label>
                <div className="max-h-40 space-y-1.5 overflow-auto">
                  {allCategories.length === 0 && <p className="text-xs text-gray-400">No categories yet.</p>}
                  {allCategories.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={() => toggle(categoryIds, setCategoryIds, c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                <Label>Tags</Label>
                <div className="max-h-40 space-y-1.5 overflow-auto">
                  {allTags.length === 0 && <p className="text-xs text-gray-400">No tags yet.</p>}
                  {allTags.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={tagIds.includes(t.id)} onChange={() => toggle(tagIds, setTagIds, t.id)} />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(m) => {
          setFeatured({ id: m.id, url: m.url });
          markDirty();
        }}
        title="Featured image"
        confirmLabel="Set featured image"
      />
    </>
  );
}
