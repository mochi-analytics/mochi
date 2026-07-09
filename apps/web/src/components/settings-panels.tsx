"use client";

import { Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/components/auth-card";

export function SharePanel({
  botId,
  shareId,
}: {
  botId: string;
  shareId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const shareUrl =
    shareId && typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareId}`
      : null;

  async function toggle(enabled: boolean) {
    setBusy(true);
    await fetch(`/api/bots/${botId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    router.refresh();
    setBusy(false);
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-3">
      {shareId ? (
        <>
          <code className="block break-all rounded bg-zinc-50 p-2 font-mono text-xs dark:bg-zinc-800">
            {shareUrl ?? `/share/${shareId}`}
          </code>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              README badge{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                (metric: servers, commands, users, or uptime)
              </span>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/badge/${shareId}?metric=servers`}
              alt="servers badge preview"
              className="h-5"
            />
            <code className="block break-all rounded bg-zinc-50 p-2 font-mono text-xs dark:bg-zinc-800">
              {`![servers](${origin}/api/badge/${shareId}?metric=servers)`}
            </code>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Embeddable widget{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                (append &amp;theme=dark for dark sites)
              </span>
            </p>
            <code className="block break-all rounded bg-zinc-50 p-2 font-mono text-xs dark:bg-zinc-800">
              {`<iframe src="${origin}/share/${shareId}/widget?range=30d" width="640" height="130" frameborder="0" title="bot stats"></iframe>`}
            </code>
          </div>

          <button
            onClick={() => toggle(false)}
            disabled={busy}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Disable sharing
          </button>
        </>
      ) : (
        <button
          onClick={() => toggle(true)}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Enable public share link
        </button>
      )}
    </div>
  );
}

type TeamOption = { id: string; name: string };

export function TeamSharePanel({
  botId,
  sharedTeams,
  myTeams,
}: {
  botId: string;
  sharedTeams: TeamOption[];
  myTeams: TeamOption[];
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sharedIds = new Set(sharedTeams.map((t) => t.id));
  const addableTeams = myTeams.filter((t) => !sharedIds.has(t.id));

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

  async function share() {
    if (!teamId) return;
    if (await call(`/api/bots/${botId}/teams`, "POST", { teamId }))
      setTeamId("");
  }
  async function unshare(id: string) {
    await call(`/api/bots/${botId}/teams/${id}`, "DELETE");
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {sharedTeams.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-200 px-3 py-4 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          Not shared with any team yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sharedTeams.map((t) => (
            <li
              key={t.id}
              className="group flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2.5 py-1.5 dark:bg-zinc-800/50"
            >
              <span className="truncate text-sm">{t.name}</span>
              <button
                onClick={() => unshare(t.id)}
                disabled={busy}
                aria-label={`Unshare from ${t.name}`}
                title={`Unshare from ${t.name}`}
                className="inline-flex shrink-0 items-center justify-center rounded p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-red-600 focus:opacity-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {myTeams.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You aren't in any teams yet — create or join one on the Teams page.
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            className={`${inputClass} min-w-0 flex-1 py-1.5 text-sm`}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={addableTeams.length === 0 || busy}
            aria-label="Share with a team"
          >
            <option value="">
              {addableTeams.length === 0
                ? "Shared with all your teams"
                : "Share with a team…"}
            </option>
            {addableTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={share}
            disabled={!teamId || busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Share
          </button>
        </div>
      )}
    </div>
  );
}

export function RetentionForm({
  botId,
  retentionDays,
}: {
  botId: string;
  retentionDays: number;
}) {
  const router = useRouter();
  const [days, setDays] = useState(String(retentionDays));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/bots/${botId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retentionDays: Number(days) }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="flex items-center gap-3">
      <input
        className={`${inputClass} max-w-32`}
        type="number"
        min={7}
        max={3650}
        value={days}
        onChange={(e) => setDays(e.target.value)}
        required
      />
      <span className="text-sm text-zinc-500 dark:text-zinc-400">days</span>
      <button
        className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        disabled={busy}
      >
        {saved ? (
          <>
            Saved <Check className="h-3.5 w-3.5" aria-hidden />
          </>
        ) : (
          "Save"
        )}
      </button>
    </form>
  );
}

export function RotateSaltButton({ botId }: { botId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function rotate() {
    if (
      !confirm(
        "Rotate the user-hash salt? Historical unique-user data becomes permanently unlinkable to future activity.",
      )
    ) {
      return;
    }
    setBusy(true);
    await fetch(`/api/bots/${botId}/rotate-salt`, { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      onClick={rotate}
      disabled={busy}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {busy ? "Rotating…" : "Rotate salt"}
    </button>
  );
}
