import { PageMeta } from "@/components/shared/page-meta";
import { useAuth } from "@/contexts";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

interface Stats {
  totals: { users: number; posts: number; pages: number; media: number };
  recentPosts: { id: number; title: string; type: string; status: string; updatedAt: string }[];
  recentUsers: { id: number; name: string; email: string; createdAt: string }[];
}

const CARDS: { key: keyof Stats["totals"]; label: string }[] = [
  { key: "posts", label: "Total Posts" },
  { key: "pages", label: "Total Pages" },
  { key: "media", label: "Media Items" },
  { key: "users", label: "Total Users" },
];

export default function CmsDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Stats>("/api/dashboard/stats")
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load stats"));
  }, []);

  return (
    <>
      <PageMeta title="Dashboard | Pixellize CMS" description="CMS admin dashboard overview" />

      <div className="space-y-6">
        <div>
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            Welcome back{user ? `, ${user.name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Here is what is happening across your site.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CARDS.map((card) => (
            <div
              key={card.key}
              className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3"
            >
              <span className="text-sm text-gray-500 dark:text-gray-400">{card.label}</span>
              <div className="mt-2">
                <span className="text-title-sm font-bold text-gray-800 dark:text-white/90">
                  {stats ? stats.totals[card.key] : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">Recent Posts</h2>
          {stats && stats.recentPosts.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.recentPosts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">{p.title}</p>
                  <span className="text-xs capitalize text-gray-400">{p.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">{stats ? "No posts yet." : "Loading…"}</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">Recent Users</h2>
          {stats && stats.recentUsers.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">{u.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats ? "No users yet." : "Loading…"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
