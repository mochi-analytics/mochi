"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/components/auth-card";

export type AlertConfigView = {
  webhookUrl: string;
  offlineEnabled: boolean;
  offlineAfterMinutes: number;
  errorSpikeEnabled: boolean;
  errorRatePct: number;
  guildDropEnabled: boolean;
  guildDropPct: number;
  digestEnabled: boolean;
};

const DEFAULTS: AlertConfigView = {
  webhookUrl: "",
  offlineEnabled: true,
  // Matches the SDKs' hourly snapshot cadence with one missed beat of slack.
  offlineAfterMinutes: 120,
  errorSpikeEnabled: true,
  errorRatePct: 10,
  guildDropEnabled: true,
  guildDropPct: 5,
  digestEnabled: false,
};

function RuleRow({
  checked,
  onChecked,
  children,
}: {
  checked: boolean;
  onChecked: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChecked(e.target.checked)}
        className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
      />
      {children}
    </label>
  );
}

function ThresholdInput({
  value,
  min,
  max,
  disabled,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${inputClass} w-20 py-1 text-sm disabled:opacity-40`}
    />
  );
}

export function AlertsPanel({
  botId,
  config,
}: {
  botId: string;
  config: AlertConfigView | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AlertConfigView>(config ?? DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof AlertConfigView>(
    key: K,
    value: AlertConfigView[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  async function call(input: RequestInfo, init?: RequestInit) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(input, init);
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        data?.issues?.[0]?.message ?? data?.error ?? "Something went wrong",
      );
      return false;
    }
    return true;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (
      await call(`/api/bots/${botId}/alerts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
    ) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  async function sendTest() {
    if (
      await call(`/api/bots/${botId}/alerts/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.webhookUrl ? { webhookUrl: form.webhookUrl } : {}),
      })
    ) {
      setMessage("Test message sent — check the channel.");
    }
  }

  async function disable() {
    if (!confirm("Disable all alerts and the weekly digest for this bot?")) return;
    if (await call(`/api/bots/${botId}/alerts`, { method: "DELETE" })) {
      setForm(DEFAULTS);
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="alert-webhook"
          className="block text-xs font-medium text-zinc-600 dark:text-zinc-300"
        >
          Discord webhook URL
        </label>
        <input
          id="alert-webhook"
          type="url"
          placeholder="https://discord.com/api/webhooks/…"
          value={form.webhookUrl}
          onChange={(e) => set("webhookUrl", e.target.value)}
          className={inputClass}
          required
        />
      </div>

      <div className="space-y-2.5">
        <RuleRow
          checked={form.offlineEnabled}
          onChecked={(v) => set("offlineEnabled", v)}
        >
          <span>Bot offline — no health snapshot for</span>
          <ThresholdInput
            value={form.offlineAfterMinutes}
            min={5}
            max={1440}
            disabled={!form.offlineEnabled}
            label="Offline threshold in minutes"
            onChange={(v) => set("offlineAfterMinutes", v)}
          />
          <span>minutes</span>
        </RuleRow>

        <RuleRow
          checked={form.errorSpikeEnabled}
          onChecked={(v) => set("errorSpikeEnabled", v)}
        >
          <span>Error spike — command failure rate over</span>
          <ThresholdInput
            value={form.errorRatePct}
            min={1}
            max={100}
            disabled={!form.errorSpikeEnabled}
            label="Error rate threshold percent"
            onChange={(v) => set("errorRatePct", v)}
          />
          <span>% in 15 minutes</span>
        </RuleRow>

        <RuleRow
          checked={form.guildDropEnabled}
          onChecked={(v) => set("guildDropEnabled", v)}
        >
          <span>Server drop — count falls</span>
          <ThresholdInput
            value={form.guildDropPct}
            min={1}
            max={100}
            disabled={!form.guildDropEnabled}
            label="Server drop threshold percent"
            onChange={(v) => set("guildDropPct", v)}
          />
          <span>% in 24 hours</span>
        </RuleRow>

        <RuleRow
          checked={form.digestEnabled}
          onChecked={(v) => set("digestEnabled", v)}
        >
          Weekly digest — last week&apos;s stats every Monday (00:00 UTC)
        </RuleRow>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          disabled={busy}
        >
          {saved ? (
            <>
              Saved <Check className="h-3.5 w-3.5" aria-hidden />
            </>
          ) : (
            "Save alerts"
          )}
        </button>
        <button
          type="button"
          onClick={sendTest}
          disabled={busy || !form.webhookUrl}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Send test message
        </button>
        {config && (
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            Disable alerts
          </button>
        )}
      </div>
    </form>
  );
}
