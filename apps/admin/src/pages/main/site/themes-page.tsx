import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { type Theme, activateTheme, listThemes } from "@/lib/cms-api";
import { useEffect, useState } from "react";

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => listThemes().then(setThemes).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  const activate = async (slug: string) => {
    await activateTheme(slug);
    void load();
  };

  return (
    <>
      <PageMeta title="Themes | Pixellize CMS" description="Manage themes" />
      <h1 className="mb-5 text-title-sm font-semibold text-gray-800 dark:text-white/90">Themes</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => (
          <div key={t.id} className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 dark:text-white/90">{t.name}</h2>
              {t.isActive && (
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600 dark:bg-green-500/10 dark:text-green-400">
                  Active
                </span>
              )}
            </div>
            <p className="mb-1 text-xs text-gray-400">v{t.version}</p>
            {t.description && <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{t.description}</p>}
            {!t.isActive && (
              <Button size="sm" onClick={() => activate(t.slug)}>
                Activate
              </Button>
            )}
          </div>
        ))}
        {themes.length === 0 && <p className="text-sm text-gray-400">No themes installed.</p>}
      </div>
    </>
  );
}
