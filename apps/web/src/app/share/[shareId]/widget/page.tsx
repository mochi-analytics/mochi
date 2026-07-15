import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MochiLogo } from "@/components/mochi-logo";
import { mochiAttributionUrl } from "@/lib/brand";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { formatCompact, formatPercent } from "@/lib/format";
import { getOverviewStats, parseRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Compact iframe-embeddable stat card (~640×130), addressed by share id like
 * the public dashboard. ?theme=dark renders the dark palette for embedding
 * on dark sites.
 */
export default async function ShareWidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ shareId: string }>;
  searchParams: Promise<{ range?: string; theme?: string }>;
}) {
  const { shareId } = await params;
  if (!z.string().uuid().safeParse(shareId).success) notFound();

  const [bot] = await db
    .select({ id: bots.id, name: bots.name })
    .from(bots)
    .where(eq(bots.shareId, shareId))
    .limit(1);
  if (!bot) notFound();

  const search = await searchParams;
  const range = parseRange(search.range);
  const stats = await getOverviewStats(bot.id, range);

  const tiles = [
    { label: "Servers", value: formatCompact(stats.guildCount) },
    { label: `Commands (${range})`, value: formatCompact(stats.commands) },
    { label: `Users (${range})`, value: formatCompact(stats.uniqueUsers) },
    { label: "Error rate", value: formatPercent(stats.errorRate) },
  ];

  return (
    <div className={search.theme === "dark" ? "dark" : undefined}>
      <div className="min-h-screen bg-white p-3 dark:bg-zinc-950">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between gap-2">
            <Link
              href={`/share/${shareId}`}
              target="_blank"
              className="truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {bot.name}
            </Link>
            <a
              href={mochiAttributionUrl("widget")}
              target="_blank"
              rel="noopener"
              className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              stats by <MochiLogo className="h-3 w-3" /> Mochi
            </a>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="min-w-0">
                <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  {tile.label}
                </div>
                <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {tile.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
