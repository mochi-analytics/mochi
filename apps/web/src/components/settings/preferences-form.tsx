"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { inputClass } from "@/components/auth-card";
import { Card, Field, SubmitButton } from "@/components/settings/ui";

type ThemePref = "light" | "dark" | "system";

const RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

/** Preferences page: theme, version, timezone, and default date range. */
export function PreferencesForm({
  version,
  timezone,
  defaultRange,
}: {
  version: string;
  timezone: string;
  defaultRange: string;
}) {
  return (
    <div className="space-y-6">
      <ThemeCard />
      <TimezoneCard current={timezone} />
      <DefaultRangeCard current={defaultRange} />
      <VersionCard version={version} />
    </div>
  );
}

/* ---------------------------------- theme --------------------------------- */

function ThemeCard() {
  const [theme, setTheme] = useState<ThemePref>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
    else setTheme("system");
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  function choose(next: ThemePref) {
    setTheme(next);
    const root = document.documentElement;
    if (next === "light") {
      localStorage.setItem("theme", "light");
      root.classList.remove("dark");
    } else if (next === "dark") {
      localStorage.setItem("theme", "dark");
      root.classList.add("dark");
    } else {
      localStorage.removeItem("theme");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      root.classList.toggle("dark", prefersDark);
    }
  }

  return (
    <Card
      title="Theme"
      description="Choose how Mochi looks. System follows your operating system."
    >
      <Field label="Appearance" htmlFor="settings-theme">
        <select
          id="settings-theme"
          className={`${inputClass} max-w-xs`}
          value={theme}
          onChange={(e) => choose(e.target.value as ThemePref)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </Field>
    </Card>
  );
}

/* -------------------------- persisted preference -------------------------- */

function usePreferenceSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
      return true;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "Failed to save");
    return false;
  }

  return { busy, saved, error, save };
}

function TimezoneCard({ current }: { current: string }) {
  const { busy, saved, error, save } = usePreferenceSave();
  const [timezone, setTimezone] = useState(current);
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [current, "UTC"];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save({ timezone });
  }

  return (
    <Card
      title="Timezone"
      description="Dashboards render dates and times in this timezone."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Timezone" htmlFor="settings-timezone">
          <select
            id="settings-timezone"
            className={`${inputClass} max-w-xs`}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {!zones.includes(current) && <option value={current}>{current}</option>}
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-center gap-3">
          <SubmitButton
            busy={busy}
            saved={saved}
            disabled={timezone === current}
            idleLabel="Save timezone"
            busyLabel="Saving…"
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </form>
    </Card>
  );
}

function DefaultRangeCard({ current }: { current: string }) {
  const { busy, saved, error, save } = usePreferenceSave();
  const [range, setRange] = useState(current);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save({ defaultRange: range });
  }

  return (
    <Card
      title="Default date range"
      description="The range applied when you open a dashboard without choosing one."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Range" htmlFor="settings-range">
          <select
            id="settings-range"
            className={`${inputClass} max-w-xs`}
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-center gap-3">
          <SubmitButton
            busy={busy}
            saved={saved}
            disabled={range === current}
            idleLabel="Save default range"
            busyLabel="Saving…"
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </form>
    </Card>
  );
}

function VersionCard({ version }: { version: string }) {
  return (
    <Card title="Version" description="The Mochi release this instance is running.">
      <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        v{version}
      </span>
    </Card>
  );
}
