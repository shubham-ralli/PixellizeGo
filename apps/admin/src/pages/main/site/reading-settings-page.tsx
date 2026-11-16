import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type PostListItem, getSettings, listPosts, saveSettings } from "@/lib/cms-api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const KEYS = ["homepageType", "homepagePageId", "postsPageId", "postsPerPage", "feedItems", "feedType"];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{children}</label>;
}

export default function ReadingSettingsPage() {
  const navigate = useNavigate();
  const [v, setV] = useState<Record<string, string>>({});
  const [pages, setPages] = useState<PostListItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setV).catch((e) => setError(e.message));
    listPosts({ type: "page", status: "published", limit: 100 }).then((r) => setPages(r.items));
  }, []);

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  const homepageType = v.homepageType || "posts";

  const save = async () => {
    setStatus(null);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const k of KEYS) payload[k] = v[k] ?? "";
      await saveSettings(payload);
      setStatus("Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <>
      <PageMeta title="Reading Settings | Pixellize CMS" description="Reading settings" />
      <div className="mb-5 flex items-center justify-between">
        <div>
          <button onClick={() => navigate("/settings")} className="text-sm text-gray-500 hover:text-brand-500">← Settings</button>
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Reading Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{status}</span>
          <Button onClick={save}>Save Changes</Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="w-full space-y-6">
        {/* Homepage displays */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">Your homepage displays</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="radio" name="homepageType" checked={homepageType === "posts"} onChange={() => set("homepageType", "posts")} />
              Your latest posts
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="radio" name="homepageType" checked={homepageType === "page"} onChange={() => set("homepageType", "page")} />
              A static page (select below)
            </label>

            {homepageType === "page" && (
              <div className="ml-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Homepage</Label>
                  <select
                    value={v.homepagePageId ?? ""}
                    onChange={(e) => set("homepagePageId", e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                  >
                    <option value="">— Select —</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Posts page</Label>
                  <select
                    value={v.postsPageId ?? ""}
                    onChange={(e) => set("postsPageId", e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                  >
                    <option value="">— None —</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">That page’s URL will show the blog feed.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Counts + feed */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Number of recent posts shown on archive pages</Label>
              <Input type="number" min={1} max={50} value={v.postsPerPage ?? "10"} onChange={(e) => set("postsPerPage", e.target.value)} />
            </div>
            <div>
              <Label>Number of recent items shown in syndication feeds</Label>
              <Input type="number" min={1} max={50} value={v.feedItems ?? "10"} onChange={(e) => set("feedItems", e.target.value)} />
            </div>
          </div>

          <div className="mt-4">
            <Label>For each post in a feed, include</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="radio" name="feedType" checked={(v.feedType || "excerpt") === "full"} onChange={() => set("feedType", "full")} />
                Full text
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="radio" name="feedType" checked={(v.feedType || "excerpt") === "excerpt"} onChange={() => set("feedType", "excerpt")} />
                Excerpt
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-400">Your theme determines how content is displayed. The RSS feed is at /feed.xml.</p>
          </div>
        </div>
      </div>
    </>
  );
}
