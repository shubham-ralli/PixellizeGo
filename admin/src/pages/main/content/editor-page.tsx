import { MediaPicker } from "@/components/shared/media-picker";
import { PageMeta } from "@/components/shared/page-meta";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { SeoPanel } from "@/components/shared/seo-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  absoluteUrl,
  autosavePost,
  createPost,
  createTerm,
  getPost,
  getRevision,
  listPostTypes,
  listPosts,
  listRevisions,
  listTaxonomies,
  listTerms,
  type PostInput,
  type PostListItem,
  type PostStatus,
  type PostTypeDef,
  type Revision,
  restoreRevision,
  type Taxonomy,
  type Term,
  updatePost,
} from "@/lib/cms-api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{children}</label>;
}

export default function ContentEditorPage() {
  const { type = "post", id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [postType, setPostType] = useState<PostTypeDef | null>(null);
  const typeLabel = postType?.label ?? "Item";
  const route = postType?.route ?? "";
  const base = `/content/${type}`;

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<PostStatus>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [featured, setFeatured] = useState<{ id: number; url: string } | null>(null);
  const [termIds, setTermIds] = useState<number[]>([]);
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [termsByTax, setTermsByTax] = useState<Record<string, Term[]>>({});
  const [newTermName, setNewTermName] = useState<Record<string, string>>({});
  const [parentId, setParentId] = useState<number | null>(null);
  const [parentOptions, setParentOptions] = useState<PostListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revOpen, setRevOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [revView, setRevView] = useState<{ id: number; content: string | null } | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    void listPostTypes().then((types) => {
      const pt = types.find((t) => t.slug === type) ?? null;
      setPostType(pt);
      // Hierarchical types (pages) can pick a parent from the same type's items.
      if (pt?.hierarchical) {
        void listPosts({ type, limit: 100 }).then((r) => setParentOptions(r.items));
      } else {
        setParentOptions([]);
      }
    });
  }, [type]);

  useEffect(() => {
    void listTaxonomies().then(async (txs) => {
      setTaxonomies(txs);
      const entries = await Promise.all(txs.map(async (t) => [t.slug, await listTerms(t.slug)] as const));
      setTermsByTax(Object.fromEntries(entries));
    });
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
      setTermIds(p.terms.map((t) => t.id));
      setParentId(p.parentId);
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
      parentId: postType?.hierarchical ? parentId : null,
      termIds,
      meta,
    }),
    [type, title, slug, excerpt, content, status, scheduledAt, featured, parentId, postType, termIds, meta],
  );

  // Primary category name for the SEO %category% token.
  const categoryName = (termsByTax.category ?? []).find((t) => termIds.includes(t.id))?.name;

  // Live public URL. For hierarchical pages the prefix is the parent's full path
  // (e.g. "/demo"); otherwise the post type's route ("/blog", or "" for pages).
  const parentPath =
    postType?.hierarchical && parentId ? parentOptions.find((p) => p.id === parentId)?.path : undefined;
  const urlPrefix = parentPath ?? (route ? `/${route}` : "");
  const computedPath = `${urlPrefix}/${slug || "untitled"}`;

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

  // Close the preview / revisions dialogs with Escape.
  useEffect(() => {
    if (!previewOpen && !revOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewOpen(false);
        setRevOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen, revOpen]);

  const toggleTerm = (termId: number) => {
    setTermIds((prev) => (prev.includes(termId) ? prev.filter((x) => x !== termId) : [...prev, termId]));
    markDirty();
  };

  const selectTerm = (termId: number) => {
    setTermIds((prev) => (prev.includes(termId) ? prev : [...prev, termId]));
    markDirty();
  };

  // Add a term from the editor: reuse it if it already exists, otherwise create it.
  const addNewTerm = async (taxSlug: string) => {
    const name = (newTermName[taxSlug] ?? "").trim();
    if (!name) return;
    const existing = (termsByTax[taxSlug] ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase());
    setNewTermName((p) => ({ ...p, [taxSlug]: "" }));
    if (existing) {
      selectTerm(existing.id);
      return;
    }
    try {
      const term = await createTerm(taxSlug, { name });
      setTermsByTax((prev) => ({ ...prev, [taxSlug]: [...(prev[taxSlug] ?? []), term] }));
      selectTerm(term.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add term");
    }
  };

  const openRevisions = async () => {
    if (!id) return;
    setRevView(null);
    setRevOpen(true);
    try {
      setRevisions(await listRevisions(Number(id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load revisions");
    }
  };
  const viewRevision = async (revId: number) => {
    if (!id) return;
    const r = await getRevision(Number(id), revId);
    setRevView({ id: r.id, content: r.content });
  };
  const doRestore = async (revId: number) => {
    if (!id || !window.confirm("Restore this revision? Current content becomes a new revision.")) return;
    try {
      const p = await restoreRevision(Number(id), revId);
      setTitle(p.title);
      setContent(p.content ?? "");
      setRevOpen(false);
      setAutoStatus("Restored revision");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    }
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
          {isEdit && (
            <Button variant="outline" onClick={openRevisions}>Revisions</Button>
          )}
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>Preview</Button>
          {isEdit && slug && status === "published" && (
            <Button
              variant="outline"
              onClick={() => window.open(absoluteUrl(computedPath), "_blank", "noopener")}
            >
              View live
            </Button>
          )}
          <Button variant="outline" disabled={saving} onClick={() => save("draft")}>
            Save Draft
          </Button>
          <Button disabled={saving} onClick={() => save("published")}>
            {saving ? "Saving…" : status === "published" ? "Update" : "Publish"}
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
          <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
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
          </div>

          <SeoPanel
            postTitle={title}
            slug={slug}
            excerpt={excerpt}
            urlPrefix={urlPrefix}
            featuredUrl={featured?.url ?? null}
            categoryName={categoryName}
            meta={meta}
            onChange={(k, v) => { setMeta({ ...meta, [k]: v }); markDirty(); }}
            onSlugChange={(v) => { setSlug(v); markDirty(); }}
          />
        </div>

        {/* Sidebar column */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
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

          {postType?.hierarchical && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
              <Label>Parent</Label>
              <select
                value={parentId ?? ""}
                onChange={(e) => { setParentId(e.target.value ? Number(e.target.value) : null); markDirty(); }}
                className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="">— None (top level) —</option>
                {parentOptions
                  .filter((p) => String(p.id) !== id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">URL becomes parent/this-slug.</p>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
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
              <Button size="sm" variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
                Choose from library
              </Button>
            )}
          </div>

          {type !== "page" &&
            taxonomies.map((tx) => {
              const terms = termsByTax[tx.slug] ?? [];
              const addField = (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={newTermName[tx.slug] ?? ""}
                    onChange={(e) => setNewTermName((p) => ({ ...p, [tx.slug]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || (!tx.hierarchical && e.key === ",")) {
                        e.preventDefault();
                        void addNewTerm(tx.slug);
                      }
                    }}
                    placeholder={`Add ${tx.label.toLowerCase()}`}
                    className="h-9 text-sm"
                  />
                  <Button size="xs" variant="outline" onClick={() => void addNewTerm(tx.slug)}>
                    Add
                  </Button>
                </div>
              );

              return (
                <div key={tx.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
                  <Label>{tx.labelPlural}</Label>

                  {tx.hierarchical ? (
                    // Categories: checkbox list + inline add.
                    <>
                      <div className="max-h-40 space-y-1.5 overflow-auto">
                        {terms.length === 0 && (
                          <p className="text-xs text-gray-400">No {tx.labelPlural.toLowerCase()} yet.</p>
                        )}
                        {terms.map((t) => (
                          <label key={t.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={termIds.includes(t.id)} onChange={() => toggleTerm(t.id)} />
                            {t.name}
                          </label>
                        ))}
                      </div>
                      {addField}
                    </>
                  ) : (
                    // Tags: chips of selected + type-to-add (creates if new) + quick-pick suggestions.
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {terms
                          .filter((t) => termIds.includes(t.id))
                          .map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                            >
                              {t.name}
                              <button type="button" className="text-brand-400 hover:text-brand-600" onClick={() => toggleTerm(t.id)}>
                                ×
                              </button>
                            </span>
                          ))}
                        {termIds.filter((id) => terms.some((t) => t.id === id)).length === 0 && (
                          <p className="text-xs text-gray-400">No {tx.labelPlural.toLowerCase()} yet.</p>
                        )}
                      </div>
                      {addField}
                      {terms.filter((t) => !termIds.includes(t.id)).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {terms
                            .filter((t) => !termIds.includes(t.id))
                            .map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => selectTerm(t.id)}
                                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-brand-400 hover:text-brand-500 dark:border-gray-700"
                              >
                                + {t.name}
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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

      {/* Unsaved-draft preview */}
      {previewOpen && (
        <div className="fixed inset-0 z-[99999] flex flex-col bg-black/50 p-4 sm:p-10" onClick={() => setPreviewOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Draft preview" className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-800">
              <span className="text-sm font-medium text-gray-500">Preview (unsaved)</span>
              <Button size="xs" variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            </div>
            <div className="overflow-auto px-6 py-8">
              <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">{title || "Untitled"}</h1>
              <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: content || "<p class='text-gray-400'>Nothing to preview yet.</p>" }} />
            </div>
          </div>
        </div>
      )}

      {/* Revisions */}
      {revOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4" onClick={() => setRevOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Revisions" className="flex h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="w-64 shrink-0 overflow-auto border-r border-gray-200 dark:border-gray-800">
              <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-gray-800 dark:text-gray-200">Revisions</div>
              {revisions.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">No revisions.</p>}
              {revisions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => viewRevision(r.id)}
                  className={`block w-full border-b border-gray-100 px-4 py-2.5 text-left dark:border-gray-800/60 ${revView?.id === r.id ? "bg-brand-50 dark:bg-brand-500/10" : ""}`}
                >
                  <p className="truncate text-sm text-gray-700 dark:text-gray-200">{r.title}</p>
                  <p className="text-xs text-gray-400">{r.kind} · {new Date(r.createdAt).toLocaleString()}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-800">
                <span className="text-sm font-medium text-gray-500">{revView ? "Revision preview" : "Select a revision"}</span>
                <div className="flex gap-2">
                  {revView && <Button size="xs" onClick={() => doRestore(revView.id)}>Restore this</Button>}
                  <Button size="xs" variant="outline" onClick={() => setRevOpen(false)}>Close</Button>
                </div>
              </div>
              <div className="overflow-auto px-6 py-6">
                {revView ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: revView.content ?? "<p class='text-gray-400'>Empty.</p>" }} />
                ) : (
                  <p className="text-sm text-gray-400">Pick a revision on the left to preview and restore it.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
