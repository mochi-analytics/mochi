"use client";

import { formatNumber, formatTooltipTime } from "@/lib/format";
import { viz } from "./theme";

export type TooltipSeries = { key: string; label: string; color: string };

/**
 * Shared tooltip: value leads (strong ink), series name follows (secondary),
 * keyed by a short line of the series color. Names/labels are rendered as
 * React text (never markup), so untrusted event names stay inert.
 */
export function ChartTooltip({
  active,
  label,
  payload,
  series,
  bucket,
}: {
  active?: boolean;
  label?: number;
  payload?: { dataKey?: string | number; value?: number | string }[];
  series: TooltipSeries[];
  bucket: "minute" | "hour" | "day";
}) {
  if (!active || !payload || payload.length === 0 || typeof label !== "number") {
    return null;
  }
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-sm"
      style={{ background: viz.surface, borderColor: viz.border }}
    >
      <div className="mb-1 text-xs" style={{ color: viz.muted }}>
        {formatTooltipTime(label, bucket)}
      </div>
      {series.map((s) => {
        const row = payload.find((p) => p.dataKey === s.key);
        if (!row) return null;
        return (
          <div key={s.key} className="flex items-center gap-2 py-0.5 text-sm">
            <span
              aria-hidden
              className="inline-block h-0.5 w-3 rounded-full"
              style={{ background: s.color }}
            />
            <span className="font-semibold" style={{ color: viz.inkPrimary }}>
              {formatNumber(Number(row.value ?? 0))}
            </span>
            <span style={{ color: viz.inkSecondary }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
