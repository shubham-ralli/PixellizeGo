import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSettings, saveSettings } from "@/lib/cms-api";
import { useEffect, useState } from "react";

interface Field {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
}

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: "General",
    fields: [
      { key: "siteTitle", label: "Site Title" },
      { key: "tagline", label: "Tagline", hint: "A short description of your site." },
      { key: "siteUrl", label: "Site URL", placeholder: "https://example.com (blank = auto-detect)" },
      { key: "adminEmail", label: "Admin Email", type: "email" },
    ],
  },
  {
    title: "Reading",
    fields: [{ key: "postsPerPage", label: "Posts per page", type: "number" }],
  },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setValues).catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    setStatus(null);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const s of SECTIONS) for (const f of s.fields) payload[f.key] = values[f.key] ?? "";
      await saveSettings(payload);
      setStatus("Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <>
      <PageMeta title="Settings | Pixellize CMS" description="Site settings" />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Settings</h1>
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

      <div className="max-w-2xl space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">{section.title}</h2>
            <div className="space-y-4">
              {section.fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{f.label}</label>
                  <Input
                    type={f.type ?? "text"}
                    value={values[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                  {f.hint && <p className="mt-1 text-xs text-gray-400">{f.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
