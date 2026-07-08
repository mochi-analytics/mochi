"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { inputClass } from "@/components/auth-card";

type ThemePref = "light" | "dark" | "system";

/**
 * Three stacked cards for the /settings page: username, password, theme.
 * The username/password cards talk to PATCH /api/user/settings; the theme
 * card is purely client-side and mirrors the pre-hydration script in the
 * root layout (localStorage `theme` + `html.dark`).
 */
export function UserSettingsForm({ username }: { username: string }) {
  return (
    <div className="space-y-6">
      <UsernameCard currentUsername={username} />
      <PasswordCard />
      <ThemeCard />
    </div>
  );
}

/* --------------------------------- shared --------------------------------- */

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function SubmitButton({
  busy,
  saved,
  disabled = false,
  idleLabel,
  busyLabel,
}: {
  busy: boolean;
  saved: boolean;
  disabled?: boolean;
  idleLabel: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {busy ? (
        busyLabel
      ) : saved ? (
        <>
          Saved <Check className="h-3.5 w-3.5" aria-hidden />
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}

/* -------------------------------- username -------------------------------- */

function UsernameCard({ currentUsername }: { currentUsername: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(currentUsername);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = username.trim().toLowerCase();
  const unchanged = trimmed === currentUsername;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unchanged) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: trimmed }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to update username");
    }
  }

  return (
    <Card
      title="Username"
      description="This is how you sign in and how others in your teams see you."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Username" htmlFor="settings-username">
          <input
            id="settings-username"
            className={`${inputClass} max-w-sm`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_.\-]+"
            title="Letters, numbers, _ . - only"
          />
        </Field>
        <div className="flex items-center gap-3">
          <SubmitButton
            busy={busy}
            saved={saved}
            disabled={unchanged}
            idleLabel="Save username"
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

/* -------------------------------- password -------------------------------- */

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setBusy(false);
    if (res.ok) {
      clearFields();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to update password");
    }
  }

  return (
    <Card
      title="Password"
      description="Use at least 8 characters. You'll stay signed in on this device."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:max-w-md">
          <Field label="Current password" htmlFor="settings-current-password">
            <input
              id="settings-current-password"
              className={inputClass}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New password" htmlFor="settings-new-password">
            <input
              id="settings-new-password"
              className={inputClass}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="settings-confirm-password">
            <input
              id="settings-confirm-password"
              className={inputClass}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <SubmitButton
            busy={busy}
            saved={saved}
            idleLabel="Update password"
            busyLabel="Updating…"
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </form>
    </Card>
  );
}

/* ---------------------------------- theme --------------------------------- */

function ThemeCard() {
  // Start with a stable value so SSR + first client render match; the actual
  // stored preference is read in the effect below to avoid hydration warnings.
  const [theme, setTheme] = useState<ThemePref>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
    else setTheme("system");
  }, []);

  // While "system" is selected, follow live OS changes.
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
