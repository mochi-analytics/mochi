"use client";

import { Trash2, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_BADGE, ROLE_LABEL, ROLE_OPTIONS } from "@/components/admin/roles";
import { inputClass } from "@/components/auth-card";
import type { AdminUser, Role } from "@/lib/admin";

export function AdminUsers({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateRole(userId: string, role: Role) {
    setBusyId(userId);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusyId(null);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to update role");
    }
  }

  async function deleteUser(user: AdminUser) {
    const bots =
      user.botCount > 0
        ? ` This permanently deletes their ${user.botCount} bot${user.botCount === 1 ? "" : "s"} and all associated analytics.`
        : "";
    if (!confirm(`Delete user "${user.username}"?${bots}`)) return;
    setBusyId(user.id);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to delete user");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
            Users
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Change roles or remove accounts. You cannot delete yourself.
          </p>
        </div>
        <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
          {users.length} total
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Bots</th>
                <th className="px-4 py-2.5 font-medium">Teams</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const isBusy = busyId === u.id;
                return (
                  <tr
                    key={u.id}
                    className="transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.username}</span>
                        {isSelf && (
                          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            you
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE[u.role]}`}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {u.botCount}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {u.teamCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          className={`${inputClass} w-auto min-w-24 py-1 text-xs`}
                          value={u.role}
                          disabled={isBusy}
                          aria-label={`Change role for ${u.username}`}
                          onChange={(e) =>
                            updateRole(u.id, e.target.value as Role)
                          }
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={isBusy || isSelf}
                          title={
                            isSelf
                              ? "You cannot delete your own account"
                              : `Delete ${u.username}`
                          }
                          aria-label={`Delete ${u.username}`}
                          className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 dark:disabled:hover:bg-transparent"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Users className="h-6 w-6 text-zinc-400 dark:text-zinc-500" aria-hidden />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No users yet.
            </p>
          </div>
        )}
      </div>

      <CreateUserForm />
    </section>
  );
}

function CreateUserForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });
    setBusy(false);
    if (res.ok) {
      setUsername("");
      setPassword("");
      setRole("user");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to create user");
    }
  }

  const roleHint = ROLE_OPTIONS.find((r) => r.value === role)?.hint;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
        Create user
      </h3>
      <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        The new account can sign in immediately with the password you set.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_9rem_auto]">
        <input
          className={inputClass}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          required
          minLength={3}
        />
        <input
          className={inputClass}
          type="password"
          placeholder="Initial password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
        <select
          className={inputClass}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          aria-label="Role"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          disabled={busy}
        >
          {busy ? "Creating…" : "Create user"}
        </button>
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">
          {ROLE_LABEL[role]}
        </span>{" "}
        · {roleHint}. At least 8-character password — share it securely.
      </p>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}
