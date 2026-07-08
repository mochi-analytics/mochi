"use client";

import { ArrowLeft, Copy, Plus, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_BADGE, ROLE_LABEL } from "@/components/admin/roles";
import { inputClass } from "@/components/auth-card";
import type { UserTeam } from "@/lib/teams";

export function TeamDetail({
  team,
  currentUserId,
}: {
  team: UserTeam;
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addUsername, setAddUsername] = useState("");

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (res.ok) return true;
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "Something went wrong");
    return false;
  }

  async function addMember() {
    const username = addUsername.trim();
    if (!username) return;
    if (await call(`/api/teams/${team.id}/members`, "POST", { username })) {
      setAddUsername("");
      router.refresh();
    }
  }
  async function removeMember(userId: string) {
    if (await call(`/api/teams/${team.id}/members/${userId}`, "DELETE"))
      router.refresh();
  }
  async function leaveTeam() {
    if (!confirm(`Leave team "${team.name}"?`)) return;
    if (await call(`/api/teams/${team.id}/members/${currentUserId}`, "DELETE"))
      router.push("/teams");
  }
  async function deleteTeam() {
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
    if (await call(`/api/teams/${team.id}`, "DELETE")) router.push("/teams");
  }

  return (
    <div className="space-y-6">
      <Link
        href="/teams"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All teams
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          <p className="mt-1 font-mono text-xs text-zinc-400 dark:text-zinc-500">
            {team.id}
          </p>
        </div>
        {team.isOwner ? (
          <button
            onClick={deleteTeam}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete team
          </button>
        ) : (
          <button
            onClick={leaveTeam}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Leave team
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {team.isOwner && <AccessCodeCard code={team.accessCode} />}

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
            Members
            <span className="font-normal text-zinc-400 dark:text-zinc-500">
              ({team.members.length})
            </span>
          </h2>
        </div>
        <div className="space-y-3 p-5">
          <ul className="space-y-1.5">
            {team.members.map((m) => {
              const isTeamOwner = m.id === currentUserId && team.isOwner;
              return (
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
                    {isTeamOwner && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Owner
                      </span>
                    )}
                  </span>
                  {team.isOwner && !isTeamOwner && (
                    <button
                      onClick={() => removeMember(m.id)}
                      disabled={busy}
                      aria-label={`Remove ${m.username}`}
                      title={`Remove ${m.username}`}
                      className="inline-flex shrink-0 items-center justify-center rounded p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-red-600 focus:opacity-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {team.isOwner && (
            <div className="flex gap-2">
              <input
                className={`${inputClass} min-w-0 flex-1 py-1.5 text-sm`}
                placeholder="Add member by username"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMember();
                  }
                }}
                maxLength={32}
              />
              <button
                onClick={addMember}
                disabled={!addUsername.trim() || busy}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AccessCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable (insecure context); ignore
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">Access code</h2>
      <p className="mt-1 mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        Share this with people you want to join the team.
      </p>
      <div className="flex items-center gap-2">
        <code className="rounded-md bg-zinc-100 px-3 py-1.5 font-mono text-sm tracking-widest dark:bg-zinc-800">
          {code}
        </code>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}
