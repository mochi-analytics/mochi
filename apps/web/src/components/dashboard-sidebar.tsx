"use client";

import {
  Bot,
  Cookie,
  Menu,
  Settings,
  Shield,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Role } from "@/lib/admin";

type NavItem = { href: string; label: string; icon: typeof Bot };

const NAV: NavItem[] = [
  { href: "/bots", label: "Bots", icon: Bot },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Preferences", icon: Settings },
];

const ADMIN_ITEM: NavItem = { href: "/admin", label: "Admin", icon: Shield };

export function DashboardSidebar({
  user,
}: {
  user: { username: string; role: Role };
}) {
  const [open, setOpen] = useState(false);
  const items = user.role === "admin" ? [...NAV, ADMIN_ITEM] : NAV;

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href="/bots"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Cookie className="h-5 w-5" aria-hidden />
          Mochi
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-md border border-zinc-300 p-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-zinc-200 bg-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link
            href="/bots"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
            onClick={() => setOpen(false)}
          >
            <Cookie className="h-5 w-5" aria-hidden />
            Mochi
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {items.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
          ))}
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Profile"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold uppercase dark:bg-zinc-700">
                {user.username.slice(0, 2)}
              </span>
              <span className="truncate">{user.username}</span>
            </Link>
            <ThemeToggle />
          </div>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={
        active
          ? "flex items-center gap-3 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}
