"use client";

import { Bot, Plus, Trash2, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_BADGE, ROLE_LABEL } from "@/components/admin/roles";
import { inputClass } from "@/components/auth-card";
import type { AdminTeam, Role } from "@/lib/admin";

type UserOption = { id: string; username: string; role: Role };
type BotOption = { id: string; name: string };

export function AdminTeams({
  teams,
  allUsers,
  allBots,
}: {
  teams: AdminTeam[];
  allUsers: UserOption[];
  allBots: BotOption[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
            Teams
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            A bot shared with a team is accessible to every member. Admins and
            users get full access; viewers see it read-only.
          </p>
        </div>
        <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
          {teams.length} total
        </span>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Users className="h-6 w-6 text-zinc-400 dark:text-zinc-500" aria-hidden />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No teams yet — create one below.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              allUsers={allUsers}
              allBots={allBots}
            />
          ))}
        </div>
      )}

      <CreateTeamForm />
    </section>
  );
}

function TeamCard({
  team,
  allUsers,
  allBots,
}: {
  team: AdminTeam;
  allUsers: UserOption[];
  allBots: BotOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addBotId, setAddBotId] = useState("");

  const memberIds = new Set(team.members.map((m) => m.id));
  const botIds = new Set(team.teamBots.map((b) => b.id));
  const addableUsers = allUsers.filter((u) => !memberIds.has(u.id));
  const addableBots = allBots.filter((b) => !botIds.has(b.id));

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      return true;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "Something went wrong");
    return false;
  }

  async function addMember() {
    if (!addUserId) return;
    if (await call(`/api/admin/teams/${team.id}/members`, "POST", { userId: addUserId }))
      setAddUserId("");
  }
  async function removeMember(userId: string) {
    await call(`/api/admin/teams/${team.id}/members/${userId}`, "DELETE");
  }
  async function addBot() {
    if (!addBotId) return;
    if (await call(`/api/admin/teams/${team.id}/bots`, "POST", { botId: addBotId }))
      setAddBotId("");
  }
  async function removeBot(botId: string) {
    await call(`/api/admin/teams/${team.id}/bots/${botId}`, "DELETE");
  }
  async function deleteTeam() {
    if (!confirm(`Delete team "${team.name}"? Members and bots are not deleted, only unshared.`))
      return;
    await call(`/api/admin/teams/${team.id}`, "DELETE");
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h3 className="truncate font-semibold">{team.name}</h3>
        <button
          onClick={deleteTeam}
          disabled={busy}
          aria-label={`Delete team ${team.name}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Delete team
        </button>
      </div>

      <div className="p-5">
        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
          {/* Members */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Members
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                ({team.members.length})
              </span>
            </h4>

            {team.members.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-200 px-3 py-4 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                No members yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {team.members.map((m) => (
                  <li
                    key={m.id}
                    className="group flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2.5 py-1.5 dark:bg-zinc-800/50"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="truncate">{m.username}</span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE[m.role]}`}
                      >
                        {ROLE_LABEL[m.role]}
                      </span>
                    </span>
                    <button
                      onClick={() => removeMember(m.id)}
                      disabled={busy}
                      aria-label={`Remove ${m.username} from ${team.name}`}
                      title={`Remove ${m.username}`}
                      className="inline-flex shrink-0 items-center justify-center rounded p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-red-600 focus:opacity-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <select
                className={`${inputClass} min-w-0 flex-1 py-1.5 text-sm`}
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                disabled={addableUsers.length === 0 || busy}
                aria-label="Add member"
              >
                <option value="">
                  {addableUsers.length === 0 ? "All users added" : "Add member…"}
                </option>
                {addableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <button
                onClick={addMember}
                disabled={!addUserId || busy}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add
              </button>
            </div>
          </div>

          {/* Bots */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <Bot className="h-3.5 w-3.5" aria-hidden />
              Shared bots
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                ({team.teamBots.length})
              </span>
            </h4>

            {team.teamBots.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-200 px-3 py-4 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                No bots shared yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {team.teamBots.map((b) => (
                  <li
                    key={b.id}
                    className="group flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2.5 py-1.5 dark:bg-zinc-800/50"
                  >
                    <span className="truncate text-sm">{b.name}</span>
                    <button
                      onClick={() => removeBot(b.id)}
                      disabled={busy}
                      aria-label={`Unshare ${b.name} from ${team.name}`}
                      title={`Unshare ${b.name}`}
                      className="inline-flex shrink-0 items-center justify-center rounded p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-red-600 focus:opacity-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <select
                className={`${inputClass} min-w-0 flex-1 py-1.5 text-sm`}
                value={addBotId}
                onChange={(e) => setAddBotId(e.target.value)}
                disabled={addableBots.length === 0 || busy}
                aria-label="Share a bot"
              >
                <option value="">
                  {addableBots.length === 0 ? "All bots shared" : "Share a bot…"}
                </option>
                {addableBots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                onClick={addBot}
                disabled={!addBotId || busy}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to create team");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Plus className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
        Create team
      </h3>
      <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        You can add members and share bots after the team is created.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className={inputClass}
          placeholder="Team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={64}
        />
        <button
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          disabled={busy}
        >
          {busy ? "Creating…" : "Create team"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}
