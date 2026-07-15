"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/components/auth-card";
import { ROLE_BADGE, ROLE_LABEL } from "@/components/admin/roles";
import { Card, Field, SubmitButton } from "@/components/settings/ui";
import type { Role } from "@/lib/admin";

/**
 * Profile page: username, read-only role, and password change. The username
 * and password cards talk to PATCH /api/user/settings.
 */
export function ProfileForm({
  username,
  role,
  email,
  hasPassword,
}: {
  username: string;
  role: Role;
  email: string | null;
  hasPassword: boolean;
}) {
  return (
    <div className="space-y-6">
      <UsernameCard currentUsername={username} />
      <RoleCard role={role} />
      {email && <DiscordCard email={email} />}
      {hasPassword && <PasswordCard />}
    </div>
  );
}

function DiscordCard({ email }: { email: string }) {
  return (
    <Card
      title="Discord account"
      description="Your verified Discord email is the unique identity for this cloud account."
    >
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{email}</p>
    </Card>
  );
}

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
      description="This is how other people in your teams see you."
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

function RoleCard({ role }: { role: Role }) {
  return (
    <Card
      title="Role"
      description="Your access level. Only an admin can change this."
    >
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[role]}`}
      >
        {ROLE_LABEL[role]}
      </span>
    </Card>
  );
}

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
