"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRESETS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

/** Preset date-range row — one row, left-aligned, scopes everything below. */
export function RangePicker({ current }: { current: string }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1">
      {PRESETS.map((preset) => {
        const active = preset.value === current;
        return (
          <Link
            key={preset.value}
            href={`${pathname}?range=${preset.value}`}
            className={
              active
                ? "rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }
          >
            {preset.label}
          </Link>
        );
      })}
    </div>
  );
}
