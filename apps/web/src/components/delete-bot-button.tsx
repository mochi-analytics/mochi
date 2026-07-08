"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteBotButton({
  botId,
  botName,
}: {
  botId: string;
  botName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function deleteBot() {
    if (!confirm(`Delete "${botName}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/bots/${botId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/bots");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={deleteBot}
      disabled={busy}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
    >
      {busy ? "Deleting…" : "Delete bot"}
    </button>
  );
}
