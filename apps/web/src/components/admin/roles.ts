import type { Role } from "@/lib/admin";

export const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "admin", label: "Admin", hint: "Full access + user & team management" },
  { value: "user", label: "User", hint: "Owns bots; full access to shared bots" },
  { value: "viewer", label: "Viewer", hint: "Read-only everywhere" },
];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  user: "User",
  viewer: "Viewer",
};

/** Tailwind classes for the role badge, keyed by role. */
export const ROLE_BADGE: Record<Role, string> = {
  admin:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  user: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  viewer:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};
