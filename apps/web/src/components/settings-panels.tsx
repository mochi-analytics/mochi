"use client";

import { Check } from "lucide-react";
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

  return (
    <div className="space-y-3">
      {shareId ? (
        <>
          <code className="block break-all rounded bg-zinc-50 p-2 font-mono text-xs dark:bg-zinc-800">
            {shareUrl ?? `/share/${shareId}`}
          </code>
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
