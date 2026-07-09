import { viz } from "@/components/charts/theme";

/**
 * Stat tile per the dataviz contract: sentence-case label, semibold
 * auto-compact value, optional signed delta colored by direction × goodness.
 */
export function StatTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: { value: number; upIsGood: boolean; suffix?: string; note?: string };
}) {
  const deltaColor =
    delta && delta.value !== 0
      ? (delta.value > 0) === delta.upIsGood
        ? viz.deltaGood
        : viz.deltaBad
      : viz.muted;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
      {delta && (
        <div className="mt-1 text-xs font-medium" style={{ color: deltaColor }}>
          {delta.value > 0 ? "+" : ""}
          {delta.value.toLocaleString("en")}
          {delta.suffix ?? ""}
          {delta.note && (
            <span className="font-normal" style={{ color: viz.muted }}>
              {" "}
              {delta.note}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
