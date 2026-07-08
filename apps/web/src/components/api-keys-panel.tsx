"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/components/auth-card";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function ApiKeysPanel({
  botId,
  keys,
}: {
  botId: string;
  keys: ApiKeyRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bots/${botId}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const body = await res.json();
      setFreshKey(body.key);
      setName("");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong");
    }
    setBusy(false);
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? Your bot will stop being able to send events with it.")) {
      return;
    }
    await fetch(`/api/bots/${botId}/keys/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {freshKey && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white p-2 font-mono text-xs dark:bg-zinc-900">
            {freshKey}
          </code>
        </div>
      )}

      {keys.length > 0 && (
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <span className={key.revokedAt ? "text-zinc-400 line-through dark:text-zinc-500" : "font-medium"}>
                  {key.name}
                </span>
                <span className="ml-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {key.keyPrefix}…
                </span>
                {key.revokedAt && (
                  <span className="ml-2 text-xs text-red-600 dark:text-red-400">revoked</span>
                )}
              </div>
              {!key.revokedAt && (
                <button
                  onClick={() => revokeKey(key.id)}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={createKey} className="flex gap-3">
        <input
          className={inputClass}
          placeholder="Key name (e.g. production)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
        <button
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          disabled={busy}
        >
          {busy ? "Creating…" : "Create key"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
