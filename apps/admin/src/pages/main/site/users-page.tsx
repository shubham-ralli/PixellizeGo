import { type Column, DataTable } from "@/components/shared/data-table";
import { PageMeta } from "@/components/shared/page-meta";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts";
import {
  type AdminUser,
  type UserRole,
  deleteUser,
  listUsers,
  updateUser,
} from "@/lib/cms-api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const ROLES: UserRole[] = ["admin", "editor", "author"];
const ROLE_STYLE: Record<UserRole, string> = {
  admin: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  editor: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  author: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
};

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} className="size-9 rounded-full object-cover" />;
  return (
    <span className="flex size-9 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => void load(), []);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const bulkDelete = async (ids: (string | number)[], clear: () => void) => {
    const targets = ids.map(Number).filter((id) => id !== me?.id);
    if (targets.length === 0 || !window.confirm(`Delete ${targets.length} user(s)?`)) return;
    setError(null);
    for (const id of targets) {
      try {
        await deleteUser(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Some users could not be deleted");
      }
    }
    clear();
    void load();
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "user",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} url={u.avatarUrl} />
          <div>
            <p className="font-medium text-gray-800 dark:text-white/90">
              {u.name}
              {me?.id === u.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}
            </p>
            <p className="text-xs text-gray-400">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <select
          value={u.role}
          onChange={(e) => run(() => updateUser(u.id, { role: e.target.value as UserRole }))}
          className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${ROLE_STYLE[u.role]}`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <button
          onClick={() => run(() => updateUser(u.id, { status: u.status === "active" ? "disabled" : "active" }))}
          className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
            u.status === "active"
              ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
              : "bg-gray-100 text-gray-500 dark:bg-white/5"
          }`}
        >
          {u.status}
        </button>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (u) => (
        <div className="flex justify-end gap-2">
          <Button size="xs" variant="outline" onClick={() => navigate(`/users/${u.id}/edit`)}>
            Edit
          </Button>
          {me?.id !== u.id && (
            <Button
              size="xs"
              variant="destructive"
              onClick={() => window.confirm(`Delete ${u.name}?`) && run(() => deleteUser(u.id))}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Users | Pixellize CMS" description="Manage users" />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Users</h1>
        <Button onClick={() => navigate("/users/new")}>+ Add User</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(u) => u.id}
        loading={loading}
        emptyText="No users."
        search={(u) => `${u.name} ${u.email}`}
        searchPlaceholder="Search users…"
        selectable
        bulkActions={(ids, clear) => (
          <Button size="xs" variant="destructive" onClick={() => bulkDelete(ids, clear)}>Delete</Button>
        )}
      />
    </>
  );
}
