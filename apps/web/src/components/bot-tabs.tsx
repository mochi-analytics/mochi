"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "commands", label: "Commands" },
  { segment: "guilds", label: "Guilds" },
  { segment: "events", label: "Events" },
  { segment: "realtime", label: "Realtime" },
  { segment: "settings", label: "Settings", writeOnly: true },
];

export function BotTabs({
  botId,
  canWrite = true,
}: {
  botId: string;
  canWrite?: boolean;
}) {
  const pathname = usePathname();
  const base = `/bots/${botId}`;
  const tabs = TABS.filter((tab) => canWrite || !tab.writeOnly);
  return (
    <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 dark:border-zinc-800">
      {tabs.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment
          ? pathname.startsWith(href)
          : pathname === base;
        return (
          <Link
            key={tab.label}
            href={href}
            className={
              active
                ? "-mb-px whitespace-nowrap border-b-2 border-zinc-900 px-3 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
