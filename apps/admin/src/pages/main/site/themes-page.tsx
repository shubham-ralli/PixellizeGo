import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { type Theme, activateTheme, listThemes } from "@/lib/cms-api";
import { useEffect, useState } from "react";

// Deterministic placeholder gradient per theme (no screenshots stored).
const GRADIENTS = [
  "from-brand-400 to-brand-600",
  "from-violet-400 to-fuchsia-600",
  "from-sky-400 to-indigo-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-pink-600",
];
const gradientFor = (slug: string) =>
  GRADIENTS[[...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => listThemes().then(setThemes).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  const activate = async (slug: string) => {
    setBusy(slug);
    try {
      await activateTheme(slug);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageMeta title="Themes | Pixellize CMS" description="Manage themes" />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Themes</h1>
        <span className="text-sm text-gray-400">{themes.length} installed</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {themes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
          No themes installed.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {themes.map((t) => (
            <div
              key={t.id}
              className={`group overflow-hidden rounded-2xl border bg-white transition dark:bg-white/[0.03] ${
                t.isActive
                  ? "border-brand-500 ring-2 ring-brand-500/30"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-800"
              }`}
            >
              {/* Preview */}
              <div className={`relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br ${gradientFor(t.slug)}`}>
                <span className="text-3xl font-bold uppercase text-white/90">{t.name.slice(0, 2)}</span>
                {t.isActive && (
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand-600 shadow-sm">
                    Active
                  </span>
                )}
                {!t.isActive && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100">
                    <Button size="sm" disabled={busy === t.slug} onClick={() => activate(t.slug)}>
                      {busy === t.slug ? "Activating…" : "Activate"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-semibold text-gray-800 dark:text-white/90">{t.name}</h2>
                  <span className="shrink-0 text-xs text-gray-400">v{t.version}</span>
                </div>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{t.description}</p>
                )}
                <div className="mt-3">
                  {t.isActive ? (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">● Currently active</span>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy === t.slug} onClick={() => activate(t.slug)}>
                      {busy === t.slug ? "Activating…" : "Activate"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
