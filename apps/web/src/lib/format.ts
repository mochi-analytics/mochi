const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const plain = new Intl.NumberFormat("en");

export function formatCompact(value: number): string {
  return value >= 10_000 ? compact.format(value) : plain.format(value);
}

export function formatNumber(value: number): string {
  return plain.format(value);
}

export function formatMs(value: number): string {
  if (value <= 0) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatTick(t: number, bucket: "minute" | "hour" | "day"): string {
  const date = new Date(t);
  if (bucket === "day") {
    return date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return date.toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

export function formatTooltipTime(t: number, bucket: "minute" | "hour" | "day"): string {
  const date = new Date(t);
  if (bucket === "day") {
    return date.toLocaleDateString("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  return `${date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}, ${formatTick(t, bucket)} UTC`;
}

export function formatRelative(t: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
