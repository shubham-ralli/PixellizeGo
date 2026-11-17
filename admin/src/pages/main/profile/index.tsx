import { MediaPicker } from "@/components/shared/media-picker";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { PageMeta } from "@/components/shared/page-meta";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { useAuth } from "@/contexts";
import { updateProfile } from "@/lib/cms-api";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const editing = pathname.endsWith("/edit");
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the form when entering edit mode (via /profile/edit) once the user is loaded.
  useEffect(() => {
    if (editing && user) {
      setName(user.name);
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setWebsite(user.website ?? "");
      setBio(user.bio ?? "");
      setAvatarUrl(user.avatarUrl ?? null);
      setError(null);
    }
  }, [editing, user]);

  const initial = (editing ? name : user?.name)?.trim()?.[0]?.toUpperCase() ?? "?";
  const shownAvatar = editing ? avatarUrl : (user?.avatarUrl ?? null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name, firstName, lastName, website, bio, avatarUrl });
      await refresh();
      navigate("/profile");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageMeta title={`${editing ? "Edit Profile" : "Profile"} | Pixellize CMS`} description="Your account profile" />
      <PageBreadcrumb pageTitle={editing ? "Edit Profile" : "Profile"} />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3">
        {!editing && (
          <div className="mb-5 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => navigate("/profile/edit")}>
              Edit
            </Button>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        <div>
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
            <div className="mt-6 w-full space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">First name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Last name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Show name (display)</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown publicly" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <Input value={user?.email ?? ""} disabled />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Website</label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
                <RichTextEditor value={bio} onChange={setBio} />
                <p className="mt-1 text-xs text-gray-400">Use the toolbar for bold and links.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/profile")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Show name" value={user?.name ?? "—"} />
                <InfoField label="First name" value={user?.firstName || "—"} />
                <InfoField label="Last name" value={user?.lastName || "—"} />
                <InfoField label="Email address" value={user?.email ?? "—"} />
                <InfoField label="Role" value={user?.role ?? "—"} />
                <InfoField label="Website" value={user?.website || "—"} />
                <InfoField
                  label="Member since"
                  value={user ? new Date(user.createdAt).toLocaleDateString() : "—"}
                />
                <InfoField label="User ID" value={user ? String(user.id) : "—"} />
              </div>
              {user?.bio && (
                <div className="mt-6">
                  <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Bio</p>
                  <div
                    className="prose prose-sm max-w-none text-sm text-gray-700 dark:text-gray-300 dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: user.bio }}
                  />
                </div>
              )}
            </>
          )}
        </div>
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
