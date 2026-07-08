import { JoinsLeavesChart } from "@/components/charts/joins-leaves-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { RangePicker } from "@/components/range-picker";
import { StatTile } from "@/components/stat-tile";
import { formatCompact, formatMs, formatPercent } from "@/lib/format";
import {
  RANGES,
  type Range,
  getCommandVolumeSeries,
  getGuildCountSeries,
  getJoinsLeavesSeries,
  getOverviewStats,
} from "@/lib/queries";

/** The overview analytics block, shared by the bot page and public share page. */
export async function OverviewDashboard({
  botId,
  range,
  emptyState,
}: {
  botId: string;
  range: Range;
  emptyState: React.ReactNode;
}) {
  const { bucket } = RANGES[range];
  const [stats, commandSeries, guildSeries, joinsLeaves] = await Promise.all([
    getOverviewStats(botId, range),
    getCommandVolumeSeries(botId, range),
    getGuildCountSeries(botId, range),
    getJoinsLeavesSeries(botId, range),
  ]);

  const hasData = stats.commands > 0 || stats.guildCount > 0 || stats.joins > 0;
  if (!hasData) return <>{emptyState}</>;

  return (
    <div className="space-y-6">
      <RangePicker current={range} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Servers"
          value={formatCompact(stats.guildCount)}
          delta={{ value: stats.joins - stats.leaves, upIsGood: true }}
        />
        <StatTile label="Commands" value={formatCompact(stats.commands)} />
        <StatTile label="Unique users" value={formatCompact(stats.uniqueUsers)} />
        <StatTile label="Error rate" value={formatPercent(stats.errorRate)} />
        <StatTile label="p95 latency" value={formatMs(stats.p95Ms)} />
        <StatTile
          label="Joins / leaves"
          value={`${formatCompact(stats.joins)} / ${formatCompact(stats.leaves)}`}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold">Servers over time</h2>
        {guildSeries.length > 1 ? (
          <TimeSeriesChart data={guildSeries} bucket={bucket} label="Servers" />
        ) : (
          <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Server counts come from snapshots — they appear once the bot has
            been online for a while in this period.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold">Commands</h2>
          <TimeSeriesChart data={commandSeries} bucket={bucket} label="Commands" />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold">Server joins & leaves</h2>
          <JoinsLeavesChart data={joinsLeaves} bucket={bucket} />
        </div>
      </div>
    </div>
  );
}
