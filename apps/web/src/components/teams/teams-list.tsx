"use client";

import { LogIn, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/components/auth-card";
import type { UserTeam } from "@/lib/teams";

export function TeamsList({
  teams,
  canCreate,
}: {
  teams: UserTeam[];
  canCreate: boolean;
}) {
  return (
    <div className="space-y-8">
      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Users className="h-6 w-6 text-zinc-400 dark:text-zinc-500" aria-hidden />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            You're not in any teams yet.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <li key={team.id}>
              <Link
                href={`/teams/${team.id}`}
                className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-semibold">{team.name}</h2>
                  {team.isOwner && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Owner
                    </span>
                  )}
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {team.members.length}{" "}
                  {team.members.length === 1 ? "member" : "members"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {canCreate && <CreateTeamForm />}
        <JoinTeamForm />
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
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.team?.id) router.push(`/teams/${data.team.id}`);
      else router.refresh();
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
        You'll own it and can add members afterwards.
      </p>
      <div className="space-y-3">
        <input
          className={inputClass}
          placeholder="Team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={64}
        />
        <button
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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

function JoinTeamForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/teams/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode: code.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.team?.id) router.push(`/teams/${data.team.id}`);
      else router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to join team");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <LogIn className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
        Join a team
      </h3>
      <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Enter an access code shared with you.
      </p>
      <div className="space-y-3">
        <input
          className={`${inputClass} font-mono uppercase`}
          placeholder="Access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={64}
        />
        <button
          className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          disabled={busy}
        >
          {busy ? "Joining…" : "Join team"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}
