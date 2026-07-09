import { EMBED_COLORS, type DiscordEmbed } from "@/lib/discord";
import { formatCompact, formatMs, formatPercent } from "@/lib/format";

/**
 * Weekly digest: a Monday-morning (00:00 UTC) Discord summary of the previous
 * seven days, sent from the alert sweep for bots that opted in.
 */

/** Monday 00:00:00 UTC of the week containing `now`. */
export function startOfIsoWeekUtc(now: number): number {
  const date = new Date(now);
  // getUTCDay(): Sunday = 0 … Saturday = 6; ISO weeks start Monday.
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return (
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
    daysSinceMonday * 86_400_000
  );
}

/** Due once per ISO week: fires on the first sweep at/after Monday 00:00 UTC. */
export function isDigestDue(now: number, lastFiredAt: Date | null): boolean {
  const weekStart = startOfIsoWeekUtc(now);
  return !lastFiredAt || lastFiredAt.getTime() < weekStart;
}

type DigestStats = {
  guildCount: number;
  commands: number;
  uniqueUsers: number;
  errorRate: number;
  p95Ms: number;
  joins: number;
  leaves: number;
};

type NamedCount = { name: string; uses?: number; count?: number };

function signed(value: number): string {
  return `${value >= 0 ? "+" : "−"}${formatCompact(Math.abs(value))}`;
}

export function buildDigestEmbed(
  botName: string,
  stats: DigestStats,
  topCommands: NamedCount[],
  topErrors: NamedCount[],
): DiscordEmbed {
  const net = stats.joins - stats.leaves;
  const commandList =
    topCommands
      .map((c) => `\`/${c.name}\` · ${formatCompact(c.uses ?? 0)}`)
      .join("\n") || "—";
  const fields = [
    {
      name: "Servers",
      value: `${formatCompact(stats.guildCount)} (${signed(net)})`,
      inline: true,
    },
    { name: "Commands", value: formatCompact(stats.commands), inline: true },
    { name: "Unique users", value: formatCompact(stats.uniqueUsers), inline: true },
    { name: "Error rate", value: formatPercent(stats.errorRate), inline: true },
    { name: "p95 latency", value: formatMs(stats.p95Ms), inline: true },
    {
      name: "Joins / leaves",
      value: `${formatCompact(stats.joins)} / ${formatCompact(stats.leaves)}`,
      inline: true,
    },
    { name: "Top commands", value: commandList, inline: false },
  ];
  if (topErrors.length > 0) {
    fields.push({
      name: "Top errors",
      value: topErrors
        .map((e) => `\`${e.name}\` · ${formatCompact(e.count ?? 0)}`)
        .join("\n"),
      inline: false,
    });
  }
  return {
    title: `📊 ${botName} — weekly digest`,
    description: "Your bot's last 7 days at a glance.",
    color: EMBED_COLORS.blue,
    fields,
  };
}
