import { Input } from "@/components/ui/input";
import { absoluteUrl, getSettings } from "@/lib/cms-api";
import { useEffect, useState } from "react";

const DEFAULT_TITLE_TEMPLATE = "%title% %sep% %sitename%";

function resolveTokens(
  tpl: string,
  vars: { title?: string; sitename?: string; category?: string; sep?: string },
): string {
  return tpl
    .replace(/%title%/g, vars.title ?? "")
    .replace(/%sitename%/g, vars.sitename ?? "")
    .replace(/%category%/g, vars.category ?? "")
    .replace(/%sep%/g, vars.sep ?? "—")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[\s|·–—-]+|[\s|·–—-]+$/g, "")
    .trim();
}

const VARIABLES: { label: string; token: string }[] = [
  { label: "Site title", token: "%sitename%" },
  { label: "Title", token: "%title%" },
  { label: "Primary category", token: "%category%" },
  { label: "Separator", token: "%sep%" },
];

interface SeoPanelProps {
  postTitle: string;
  slug: string;
  excerpt: string;
  urlPrefix: string; // path before the slug, e.g. "", "/blog", "/demo"
  featuredUrl?: string | null;
  categoryName?: string;
  meta: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSlugChange: (value: string) => void;
}

/** Length band → color (Yoast-style): red (empty/too long), amber (short), green (good). */
function band(len: number, min: number, max: number): "red" | "amber" | "green" {
  if (len === 0 || len > max) return "red";
  if (len < min) return "amber";
  return "green";
}
const BAR = { red: "bg-red-500", amber: "bg-amber-400", green: "bg-green-500" };
const TXT = { red: "text-red-500", amber: "text-amber-500", green: "text-green-600 dark:text-green-400" };
const HINT = {
  red: "Too long — may be truncated",
  amber: "A bit short",
  green: "Good length",
};

function Meter({ len, min, max }: { len: number; min: number; max: number }) {
  const c = band(len, min, max);
  const hint = len === 0 ? "Required for best results" : HINT[c];
  return (
    <div className="mt-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div className={`h-full rounded-full ${BAR[c]}`} style={{ width: `${Math.min(100, (len / max) * 100)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <span className={TXT[c]}>{hint}</span>
        <span className="text-gray-400">
          {len} / {max}
        </span>
      </div>
    </div>
  );
}

const ADVANCED_FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: "canonicalUrl", label: "Canonical URL", placeholder: "https://… (leave blank for default)" },
  { key: "ogTitle", label: "Open Graph Title" },
  { key: "ogDescription", label: "Open Graph Description" },
  { key: "ogImage", label: "Open Graph Image URL" },
];

export function SeoPanel({
  postTitle,
  slug,
  excerpt,
  urlPrefix,
  featuredUrl,
  categoryName,
  meta,
  onChange,
  onSlugChange,
}: SeoPanelProps) {
  const [advanced, setAdvanced] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [site, setSite] = useState<{ title: string; sep: string }>({ title: "", sep: "—" });

  useEffect(() => {
    getSettings()
      .then((s) => setSite({ title: s.siteTitle || "Pixellize", sep: s.seoTitleSeparator || "—" }))
      .catch(() => {});
  }, []);

  const tokenVars = { title: postTitle, sitename: site.title, category: categoryName, sep: site.sep };
  const effTitle = resolveTokens(meta.metaTitle || DEFAULT_TITLE_TEMPLATE, tokenVars);
  const effDesc = meta.metaDescription || excerpt || "";
  const url = absoluteUrl(`${urlPrefix}/${slug || "sample-slug"}`);
  const ogTitle = meta.ogTitle || effTitle;
  const ogDesc = meta.ogDescription || effDesc;
  const ogImage = meta.ogImage || featuredUrl || "";
  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  const insertVar = (token: string) => {
    const cur = meta.metaTitle ?? "";
    onChange("metaTitle", (cur ? `${cur} ` : "") + token);
    setVarsOpen(false);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
      <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white/90">SEO &amp; Open Graph</h3>

      {/* Search result preview */}
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Search preview</p>
      <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/3">
        <div className="p-4">
          <p className="truncate text-xs text-green-700 dark:text-green-500">{url}</p>
          <p className="truncate text-base font-medium text-[#1a0dab] dark:text-blue-400">
            {effTitle || "Your title here"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
            {effDesc || "Your meta description will appear here…"}
          </p>
        </div>
      </div>

      {/* Social share card preview (Open Graph / Twitter) */}
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Social share preview</p>
      <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-gray-100 dark:bg-white/5">
          {ogImage ? (
            <img src={ogImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-gray-400">No image — add a featured or OG image</span>
          )}
        </div>
        <div className="border-t border-gray-100 p-3 dark:border-gray-800">
          <p className="truncate text-[11px] uppercase tracking-wide text-gray-400">{domain}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-gray-800 dark:text-white/90">
            {ogTitle || "Your title here"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {ogDesc || "Your description will appear here…"}
          </p>
        </div>
      </div>

      {/* Meta Title */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Meta Title</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setVarsOpen((v) => !v)}
              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Insert variable ▾
            </button>
            {varsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setVarsOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVar(v.token)}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <Input
          value={meta.metaTitle ?? ""}
          onChange={(e) => onChange("metaTitle", e.target.value)}
          placeholder={DEFAULT_TITLE_TEMPLATE}
        />
        <Meter len={effTitle.length} min={30} max={60} />
      </div>

      {/* URL slug */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">URL</label>
        <Input value={slug} onChange={(e) => onSlugChange(e.target.value)} placeholder="sample-post-7" />
      </div>

      {/* Meta Description */}
      <div className="mb-2">
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Meta Description</label>
        <textarea
          value={meta.metaDescription ?? ""}
          onChange={(e) => onChange("metaDescription", e.target.value)}
          rows={3}
          placeholder="Defaults to the excerpt"
          className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
        />
        <Meter len={effDesc.length} min={70} max={160} />
      </div>

      {/* Advanced */}
      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="mt-2 flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400"
      >
        <span className={`transition-transform ${advanced ? "rotate-90" : ""}`}>›</span> Advanced
      </button>

      {advanced && (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          {ADVANCED_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{f.label}</label>
              <Input value={meta[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => onChange(f.key, e.target.value)} />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={meta.robots === "noindex,nofollow"}
              onChange={(e) => onChange("robots", e.target.checked ? "noindex,nofollow" : "")}
            />
            Hide this from search engines (noindex)
          </label>
        </div>
      )}
    </div>
  );
}
