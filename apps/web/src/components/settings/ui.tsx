"use client";

import { Check } from "lucide-react";

/** Shared layout primitives for the Profile and Preferences pages. */

export function Card({
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

export function Field({
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

export function SubmitButton({
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
