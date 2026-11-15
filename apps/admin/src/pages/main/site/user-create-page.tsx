import { MediaPicker } from "@/components/shared/media-picker";
import { PageMeta } from "@/components/shared/page-meta";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type UserRole, createUser } from "@/lib/cms-api";
import { useState } from "react";
import { useNavigate } from "react-router";

const ROLES: UserRole[] = ["admin", "editor", "author"];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{children}</label>;
}

export default function UserCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("author");
  const [status, setStatus] = useState<"active" | "disabled">("active");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await createUser({ name, email, password, role, status, firstName, lastName, website, bio, avatarUrl });
      navigate("/users");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create user");
    } finally {
      setSaving(false);
    }
  };

  const initial = name.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <PageMeta title="New User | Pixellize CMS" description="Create a user" />

      <div className="mb-5">
        <button onClick={() => navigate("/users")} className="text-sm text-gray-500 hover:text-brand-500">
          ← Users
        </button>
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">New User</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="w-full space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="size-16 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="bg-black text-xl font-medium text-white">{initial}</AvatarFallback>
          </Avatar>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>Change image</Button>
            {avatarUrl && (
              <Button size="sm" variant="outline" onClick={() => setAvatarUrl(null)}>Remove</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>First name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
          </div>
          <div>
            <Label>Last name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
          </div>
          <div>
            <Label>Show name (display)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown publicly" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <Label>Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm capitalize text-gray-700 dark:border-gray-700 dark:text-gray-300"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "disabled")}
              className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm capitalize text-gray-700 dark:border-gray-700 dark:text-gray-300"
            >
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
          <div>
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
          </div>
        </div>

        <div>
          <Label>Bio</Label>
          <RichTextEditor value={bio} onChange={setBio} />
          <p className="mt-1 text-xs text-gray-400">Use the toolbar for bold and links.</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create User"}</Button>
          <Button variant="outline" onClick={() => navigate("/users")}>Cancel</Button>
        </div>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(m) => setAvatarUrl(m.url)}
        title="Profile image"
        confirmLabel="Use image"
      />
    </>
  );
}
