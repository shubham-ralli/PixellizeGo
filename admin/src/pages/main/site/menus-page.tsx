import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Menu,
  type MenuLink,
  createMenu,
  deleteMenu,
  listMenus,
  listPostTypes,
  listPosts,
  listTaxonomies,
  listTerms,
  updateMenu,
} from "@/lib/cms-api";
import { useEffect, useMemo, useState } from "react";

/** Relative public path for a post/term: /blog/slug, /slug (route ""), /category/news. */
const pathFor = (route: string, slug: string) => (route ? `/${route}/${slug}` : `/${slug}`);

// The menu structure is edited as a flat list with a depth (0 = top level, 1 = sub item)
// and converted to/from the stored nested tree. Capped at 2 levels (matches most menus).
interface FlatItem {
  label: string;
  url: string;
  depth: number;
}

const MAX_DEPTH = 2; // 3 visible levels (0, 1, 2)

function flatten(items: MenuLink[], depth = 0, out: FlatItem[] = []): FlatItem[] {
  for (const it of items) {
    out.push({ label: it.label, url: it.url, depth: Math.min(depth, MAX_DEPTH) });
    if (it.children?.length) flatten(it.children, depth + 1, out);
  }
  return out;
}

/** Flat list (with depth) → nested tree. A stack tracks the current ancestor per depth. */
function toTree(flat: FlatItem[]): MenuLink[] {
  const root: MenuLink[] = [];
  const stack: { node: MenuLink; depth: number }[] = [];
  for (const f of flat) {
    if (!f.label.trim() || !f.url.trim()) continue;
    const node: MenuLink = { label: f.label.trim(), url: f.url.trim() };
    while (stack.length && stack[stack.length - 1]!.depth >= f.depth) stack.pop();
    if (stack.length === 0) root.push(node);
    else (stack[stack.length - 1]!.node.children ??= []).push(node);
    stack.push({ node, depth: f.depth });
  }
  return root;
}

interface Source {
  key: string;
  title: string;
  load: () => Promise<MenuLink[]>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{children}</label>;
}

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [items, setItems] = useState<FlatItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // "Add menu items" sources + lazy-loaded entries + per-source checkbox selection.
  const [sources, setSources] = useState<Source[]>([]);
  const [openSource, setOpenSource] = useState<string | null>("__custom");
  const [sourceItems, setSourceItems] = useState<Record<string, MenuLink[]>>({});
  const [sourceLoading, setSourceLoading] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, Set<number>>>({});
  const [customLabel, setCustomLabel] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const load = async () => {
    const list = await listMenus().catch((e) => {
      setError(e.message);
      return [] as Menu[];
    });
    setMenus(list);
    if (list.length && selectedId === null) select(list[0]);
  };
  useEffect(() => void load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build sources once: every post type (published content) + every taxonomy (terms).
  useEffect(() => {
    void (async () => {
      const [types, taxes] = await Promise.all([listPostTypes(), listTaxonomies()]);
      const typeSources: Source[] = types.map((pt) => ({
        key: `type:${pt.slug}`,
        title: pt.labelPlural,
        load: async () => {
          const { items } = await listPosts({ type: pt.slug, status: "published", limit: 100 });
          return items.map((p) => ({ label: p.title, url: pathFor(pt.route, p.slug) }));
        },
      }));
      const taxSources: Source[] = taxes.map((tx) => ({
        key: `tax:${tx.slug}`,
        title: tx.labelPlural,
        load: async () => {
          const terms = await listTerms(tx.slug);
          return terms.map((t) => ({ label: t.name, url: pathFor(tx.route, t.slug) }));
        },
      }));
      setSources([...typeSources, ...taxSources]);
    })();
  }, []);

  const toggleSource = async (key: string, loader?: () => Promise<MenuLink[]>) => {
    if (openSource === key) {
      setOpenSource(null);
      return;
    }
    setOpenSource(key);
    if (loader && !sourceItems[key]) {
      setSourceLoading(key);
      try {
        const entries = await loader();
        setSourceItems((prev) => ({ ...prev, [key]: entries }));
      } finally {
        setSourceLoading(null);
      }
    }
  };

  const toggleCheck = (key: string, idx: number) => {
    setChecked((prev) => {
      const set = new Set(prev[key] ?? []);
      if (set.has(idx)) set.delete(idx);
      else set.add(idx);
      return { ...prev, [key]: set };
    });
  };

  const addChecked = (key: string) => {
    const set = checked[key];
    const entries = sourceItems[key];
    if (!set || !entries || set.size === 0) return;
    const picked = [...set].sort((a, b) => a - b).map((i) => entries[i]);
    setItems((prev) => [...prev, ...picked.map((e) => ({ label: e.label, url: e.url, depth: 0 }))]);
    setChecked((prev) => ({ ...prev, [key]: new Set() }));
    setStatus(`Added ${picked.length} item(s) — remember to Save`);
  };

  const select = (m: Menu) => {
    setSelectedId(m.id);
    setName(m.name);
    setLocation(m.location ?? "");
    setItems(flatten(m.items ?? []));
    setStatus(null);
  };

  const addCustom = () => {
    if (!customLabel.trim() || !customUrl.trim()) return;
    setItems((prev) => [...prev, { label: customLabel.trim(), url: customUrl.trim(), depth: 0 }]);
    setCustomLabel("");
    setCustomUrl("");
    setStatus("Added — remember to Save");
  };

  const setItem = (i: number, patch: Partial<FlatItem>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => {
    // Remove the item and its nested descendants.
    const d = items[i].depth;
    let end = i + 1;
    while (end < items.length && items[end].depth > d) end++;
    setItems([...items.slice(0, i), ...items.slice(end)]);
  };

  // Indices of item `i` plus its descendants (a contiguous deeper-depth run).
  const subtree = (i: number): number[] => {
    const d = items[i].depth;
    const out = [i];
    for (let j = i + 1; j < items.length && items[j].depth > d; j++) out.push(j);
    return out;
  };

  // Drag item (with its subtree) to before index `to`.
  const moveTo = (from: number, to: number) => {
    const block = subtree(from);
    if (block.includes(to)) return; // can't drop inside itself
    const moving = block.map((i) => items[i]);
    const rest = items.filter((_, idx) => !block.includes(idx));
    const target = items[to];
    let at = rest.indexOf(target);
    if (at < 0) at = rest.length;
    setItems([...rest.slice(0, at), ...moving, ...rest.slice(at)]);
    setStatus("Reordered — remember to Save");
  };

  // Keyboard reorder: move an item (with its subtree) one slot up/down.
  const moveBlock = (i: number, dir: -1 | 1) => {
    const len = subtree(i).length;
    const moving = items.slice(i, i + len);
    const rest = [...items.slice(0, i), ...items.slice(i + len)];
    const at = dir < 0 ? Math.max(0, i - 1) : Math.min(rest.length, i + 1);
    setItems([...rest.slice(0, at), ...moving, ...rest.slice(at)]);
    setStatus("Reordered — remember to Save");
  };

  const indent = (i: number) => {
    // Can nest one level deeper than the item directly above it (max MAX_DEPTH).
    if (i === 0) return;
    const max = Math.min(items[i - 1].depth + 1, MAX_DEPTH);
    if (items[i].depth >= max) return;
    setItem(i, { depth: items[i].depth + 1 });
  };
  const outdent = (i: number) => {
    if (items[i].depth <= 0) return;
    setItem(i, { depth: items[i].depth - 1 });
  };

  const save = async () => {
    setStatus(null);
    setError(null);
    try {
      const tree = toTree(items);
      if (selectedId) {
        await updateMenu(selectedId, { name, location: location || null, items: tree });
      } else {
        const created = await createMenu({ name: name || "Menu", location: location || null, items: tree });
        setSelectedId(created.id);
      }
      setStatus("Saved");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  const newMenu = () => {
    setSelectedId(null);
    setName("New Menu");
    setLocation("");
    setItems([]);
    setStatus(null);
  };

  const remove = async () => {
    if (!selectedId || !window.confirm("Delete this menu?")) return;
    await deleteMenu(selectedId);
    setSelectedId(null);
    setName("");
    setItems([]);
    await load();
  };

  const hasMenu = selectedId !== null || name !== "";
  const locationTaken = useMemo(
    () => menus.find((m) => m.location && m.location === location && m.id !== selectedId)?.name,
    [menus, location, selectedId],
  );

  const renderSourceBody = (key: string) => {
    const entries = sourceItems[key] ?? [];
    const set = checked[key] ?? new Set<number>();
    return (
      <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-800">
        <div className="max-h-56 space-y-1 overflow-auto">
          {sourceLoading === key && <p className="px-1 text-sm text-gray-400">Loading…</p>}
          {sourceLoading !== key && entries.length === 0 && (
            <p className="px-1 text-sm text-gray-400">Nothing published yet.</p>
          )}
          {entries.map((entry, i) => (
            <label
              key={`${entry.url}-${i}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <input type="checkbox" checked={set.has(i)} onChange={() => toggleCheck(key, i)} />
              <span className="truncate">{entry.label}</span>
            </label>
          ))}
        </div>
        {entries.length > 0 && (
          <Button size="sm" variant="outline" className="mt-2 w-full" disabled={set.size === 0} onClick={() => addChecked(key)}>
            Add to menu{set.size > 0 ? ` (${set.size})` : ""}
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <PageMeta title="Menus | Pixellize CMS" description="Navigation menus" />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Menus</h1>
        <Button variant="outline" onClick={newMenu}>+ New Menu</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Your menus — top bar */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Your menus</p>
        <div className="flex flex-wrap gap-2">
          {menus.length === 0 && <p className="text-sm text-gray-400">No menus yet.</p>}
          {menus.map((m) => (
            <button
              key={m.id}
              onClick={() => select(m)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                selectedId === m.id
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                  : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:text-gray-300"
              }`}
            >
              {m.name}
              {m.location && <span className="ml-1 text-xs text-gray-400">· {m.location}</span>}
              <span className="ml-1 text-xs text-gray-400">({m.items?.length ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {!hasMenu ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
          Select a menu above, or create a new one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* LEFT: Add menu items (25%) */}
          <div className="space-y-3 lg:col-span-1">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Add menu items</h3>

            {/* Custom link */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800">
              <button
                onClick={() => toggleSource("__custom")}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Custom link
                <span className="text-gray-400">{openSource === "__custom" ? "−" : "+"}</span>
              </button>
              {openSource === "__custom" && (
                <div className="space-y-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
                  <Input placeholder="Link text" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
                  <Input placeholder="URL (e.g. /about or https://…)" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} />
                  <Button size="sm" className="w-full" onClick={addCustom}>Add to menu</Button>
                </div>
              )}
            </div>

            {/* Content sources (post types + taxonomies) */}
            {sources.map((s) => (
              <div key={s.key} className="rounded-xl border border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => toggleSource(s.key, s.load)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {s.title}
                  <span className="text-gray-400">{openSource === s.key ? "−" : "+"}</span>
                </button>
                {openSource === s.key && renderSourceBody(s.key)}
              </div>
            ))}
          </div>

          {/* RIGHT: Menu structure + settings (75%) */}
          <div className="space-y-4 lg:col-span-3">
            <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Menu name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Location</Label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                  >
                    <option value="">— Not assigned —</option>
                    <option value="primary">Primary (header)</option>
                    <option value="footer">Footer</option>
                    {location && !["primary", "footer"].includes(location) && <option value={location}>{location}</option>}
                  </select>
                  {locationTaken && (
                    <p className="mt-1 text-xs text-amber-500">“{locationTaken}” already uses this location; saving will move it here.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <h3 className="mb-1 text-sm font-semibold text-gray-800 dark:text-white/90">Menu structure</h3>
              <p className="mb-3 text-xs text-gray-400">Drag ⠿ to reorder; use → / ← to nest items (up to 3 levels).</p>
              {items.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400 dark:border-gray-700">
                  Check items on the left and click “Add to menu”.
                </p>
              )}
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div
                    key={i}
                    style={{ marginLeft: it.depth * 28 }}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dropIndex !== i) setDropIndex(i);
                    }}
                    onDrop={() => {
                      if (dragIndex !== null && dragIndex !== i) moveTo(dragIndex, i);
                      setDragIndex(null);
                      setDropIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDropIndex(null);
                    }}
                    className={`rounded-xl border p-3 dark:border-gray-800 ${
                      dropIndex === i && dragIndex !== null && dragIndex !== i
                        ? "border-brand-400 ring-2 ring-brand-400/30"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-2.5 cursor-grab select-none text-gray-400 active:cursor-grabbing" title="Drag to reorder" role="img" aria-label="Drag to reorder">⠿</span>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input placeholder="Label" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
                          {it.depth > 0 && <span className="shrink-0 text-xs italic text-gray-400">{it.depth === 1 ? "sub item" : "sub-sub item"}</span>}
                        </div>
                        <Input placeholder="URL" value={it.url} onChange={(e) => setItem(i, { url: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <Button size="xs" variant="outline" disabled={i === 0} onClick={() => moveBlock(i, -1)} title="Move up" aria-label="Move up">↑</Button>
                        <Button size="xs" variant="outline" disabled={i === items.length - 1} onClick={() => moveBlock(i, 1)} title="Move down" aria-label="Move down">↓</Button>
                        <Button size="xs" variant="outline" disabled={it.depth <= 0} onClick={() => outdent(i)} title="Outdent" aria-label="Outdent">←</Button>
                        <Button size="xs" variant="outline" disabled={i === 0 || it.depth >= Math.min(items[i - 1].depth + 1, 2)} onClick={() => indent(i)} title="Indent" aria-label="Indent">→</Button>
                        <Button size="xs" variant="destructive" className="col-span-2" onClick={() => removeItem(i)}>✕ Remove</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button onClick={save}>Save Menu</Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{status}</span>
                {selectedId && <Button variant="destructive" onClick={remove}>Delete</Button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
