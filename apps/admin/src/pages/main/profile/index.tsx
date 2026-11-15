import { MediaPicker } from "@/components/shared/media-picker";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { PageMeta } from "@/components/shared/page-meta";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts";
import { updateProfile } from "@/lib/cms-api";
import { useState } from "react";

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = (editing ? name : user?.name)?.trim()?.[0]?.toUpperCase() ?? "?";
  const shownAvatar = editing ? avatarUrl : (user?.avatarUrl ?? null);

  const startEdit = () => {
    setName(user?.name ?? "");
    setAvatarUrl(user?.avatarUrl ?? null);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name, avatarUrl });
      await refresh();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageMeta title="Profile | Pixellize CMS" description="Your account profile" />
      <PageBreadcrumb pageTitle="Profile" />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3">
        <div className="mb-5 flex items-center justify-between lg:mb-7">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Profile</h3>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              Edit
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        <Card className="border border-gray-200 p-5 sm:p-6 dark:border-gray-700">
          <div className="flex items-center gap-4 sm:gap-6">
            <Avatar className="size-20 shrink-0">
              {shownAvatar && <AvatarImage src={shownAvatar} alt={user?.name ?? ""} />}
              <AvatarFallback className="bg-black text-2xl font-medium text-white">{initial}</AvatarFallback>
            </Avatar>

            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                  Change image
                </Button>
                {avatarUrl && (
                  <Button size="sm" variant="outline" onClick={() => setAvatarUrl(null)}>
                    Remove
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{user?.name ?? "—"}</h2>
                <span className="text-sm capitalize text-gray-500 dark:text-gray-400">{user?.role ?? ""}</span>
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-6 max-w-md space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Name" value={user?.name ?? "—"} />
              <InfoField label="Email address" value={user?.email ?? "—"} />
              <InfoField label="Role" value={user?.role ?? "—"} />
              <InfoField
                label="Member since"
                value={user ? new Date(user.createdAt).toLocaleDateString() : "—"}
              />
              <InfoField label="User ID" value={user ? String(user.id) : "—"} />
            </div>
          )}
        </Card>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(m) => setAvatarUrl(m.url)}
        title="Profile image"
        confirmLabel="Use image"
      />
    </div>
  );
}
