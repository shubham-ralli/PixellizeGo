import { MediaPicker } from "@/components/shared/media-picker";
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
];

const BRANDING_KEYS = ["siteLogo", "siteIcon"];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | "siteLogo" | "siteIcon">(null);

  useEffect(() => {
    getSettings().then(setValues).catch((e) => setError(e.message));
  }, []);

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const save = async () => {
    setStatus(null);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const s of SECTIONS) for (const f of s.fields) payload[f.key] = values[f.key] ?? "";
      for (const k of BRANDING_KEYS) payload[k] = values[k] ?? "";
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

      <div className="w-full space-y-6">
        {/* Branding: logo + site icon (favicon) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">Branding</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Logo</label>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/5">
                  {values.siteLogo ? (
                    <img src={values.siteLogo} alt="logo" className="max-h-14 max-w-[7rem] object-contain" />
                  ) : (
                    <span className="text-xs text-gray-400">No logo</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPicker("siteLogo")}>Choose</Button>
                  {values.siteLogo && (
                    <Button size="sm" variant="outline" onClick={() => set("siteLogo", "")}>Remove</Button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">Shown in the site header instead of the title.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Site icon (favicon)</label>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/5">
                  {values.siteIcon ? (
                    <img src={values.siteIcon} alt="icon" className="h-10 w-10 object-contain" />
                  ) : (
                    <span className="text-[10px] text-gray-400">None</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPicker("siteIcon")}>Choose</Button>
                  {values.siteIcon && (
                    <Button size="sm" variant="outline" onClick={() => set("siteIcon", "")}>Remove</Button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">Appears in the browser tab. A square PNG works best.</p>
            </div>
          </div>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
            <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">{section.title}</h2>
            <div className="space-y-4">
              {section.fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{f.label}</label>
                  <Input
                    type={f.type ?? "text"}
                    value={values[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                  {f.hint && <p className="mt-1 text-xs text-gray-400">{f.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <MediaPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onSelect={(m) => picker && set(picker, m.url)}
        title={picker === "siteIcon" ? "Site icon" : "Logo"}
        confirmLabel="Use image"
      />
    </>
  );
}
