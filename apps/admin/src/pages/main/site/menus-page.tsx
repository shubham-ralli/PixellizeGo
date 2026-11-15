import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Menu,
  type MenuLink,
  createMenu,
  deleteMenu,
  listMenus,
  updateMenu,
} from "@/lib/cms-api";
import { useEffect, useState } from "react";

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [items, setItems] = useState<MenuLink[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const list = await listMenus().catch((e) => {
      setError(e.message);
      return [] as Menu[];
    });
    setMenus(list);
    if (list.length && selectedId === null) select(list[0]);
  };
  useEffect(() => void load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (m: Menu) => {
    setSelectedId(m.id);
    setName(m.name);
    setLocation(m.location ?? "");
    setItems(m.items ?? []);
    setStatus(null);
  };

  const addItem = () => setItems([...items, { label: "", url: "" }]);
  const setItem = (i: number, patch: Partial<MenuLink>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  const save = async () => {
    setStatus(null);
    setError(null);
    const cleanItems = items.filter((it) => it.label.trim() && it.url.trim());
    try {
      if (selectedId) {
        await updateMenu(selectedId, { name, location: location || null, items: cleanItems });
      } else {
        const created = await createMenu({ name: name || "Menu", location: location || null, items: cleanItems });
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
  };

  const remove = async () => {
    if (!selectedId || !window.confirm("Delete this menu?")) return;
    await deleteMenu(selectedId);
    setSelectedId(null);
    setName("");
    setItems([]);
    await load();
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-2">
          {menus.map((m) => (
            <button
              key={m.id}
              onClick={() => select(m)}
              className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                selectedId === m.id
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                  : "border-gray-200 text-gray-700 dark:border-gray-800 dark:text-gray-300"
              }`}
            >
              {m.name}
              {m.location && <span className="ml-1 text-xs text-gray-400">({m.location})</span>}
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 space-y-4 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Menu name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Location (e.g. primary)
              </label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="primary" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</span>
              <Button size="xs" variant="outline" onClick={addItem}>+ Add item</Button>
            </div>
            <div className="space-y-2">
              {items.length === 0 && <p className="text-sm text-gray-400">No items. Add one.</p>}
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Label" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
                  <Input placeholder="URL (e.g. /about)" value={it.url} onChange={(e) => setItem(i, { url: e.target.value })} />
                  <Button size="xs" variant="outline" onClick={() => move(i, -1)}>↑</Button>
                  <Button size="xs" variant="outline" onClick={() => move(i, 1)}>↓</Button>
                  <Button size="xs" variant="destructive" onClick={() => removeItem(i)}>✕</Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button onClick={save}>Save Menu</Button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{status}</span>
              {selectedId && (
                <Button variant="destructive" onClick={remove}>Delete</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
