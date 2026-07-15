import { AutoRefresh } from "@/components/auto-refresh";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { viz } from "@/components/charts/theme";
import { RangePicker } from "@/components/range-picker";
import { StatTile } from "@/components/stat-tile";
import { getCurrentUser } from "@/lib/auth/session";
import {
  formatCompact,
  formatMemMb,
  formatMs,
  formatNumber,
  formatPercent,
  formatRelative,
} from "@/lib/format";
import {
  RANGES,
  getPingSeries,
  getResourceSeries,
  getShardStatuses,
  getUptime,
  parseRange,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

/** A shard is "online" if its newest snapshot is fresher than this — the
 * SDKs snapshot hourly by default, so this must comfortably exceed that. */
const ONLINE_THRESHOLD_MS = 75 * 60_000;

export default async function HealthPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { botId } = await params;
  const user = await getCurrentUser();
  const range = parseRange((await searchParams).range, user?.defaultRange);
  const { bucket } = RANGES[range];

  const [shards, pingSeries, resourceSeries, uptime] = await Promise.all([
    getShardStatuses(botId),
    getPingSeries(botId, range),
    getResourceSeries(botId, range),
    getUptime(botId, range),
  ]);

  if (shards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-10 text-center">
        <p className="font-medium">No health data yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Health comes from periodic snapshots — the Mochi SDKs send them
          automatically once attached. Shard status, uptime, and gateway ping
          appear here as soon as the first snapshot arrives.
        </p>
      </div>
    );
  }

  const now = Date.now();
  const online = shards.filter((s) => now - s.lastSeen < ONLINE_THRESHOLD_MS);
  const allOnline = online.length === shards.length;
  const totalGuilds = shards.reduce((sum, s) => sum + s.guilds, 0);
  const latestPing = online.length
    ? Math.round(online.reduce((sum, s) => sum + s.ping, 0) / online.length)
    : 0;
  // CPU is per-process, so sum across online shards for a fleet-wide figure;
  // memory likewise. Gated on any shard actually reporting resources.
  const hasResources = shards.some((s) => s.mem > 0);
  const totalMem = online.reduce((sum, s) => sum + s.mem, 0);
  const avgCpu = online.length
    ? online.reduce((sum, s) => sum + s.cpu, 0) / online.length
    : 0;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30_000} />
      <RangePicker current={range} />

      <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="relative flex h-2 w-2">
          {allOnline && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${allOnline ? "bg-emerald-500" : online.length > 0 ? "bg-amber-500" : "bg-red-500"}`}
          />
        </span>
        {allOnline
          ? "All shards online"
          : online.length > 0
            ? `${online.length} of ${shards.length} shards online`
            : "Offline — no recent snapshots"}
        <span className="text-zinc-400 dark:text-zinc-500">· updates every 30s</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={`Uptime (${RANGES[range].label.toLowerCase().replace("last ", "")})`}
          value={uptime === null ? "—" : `${uptime.toFixed(uptime >= 99.95 ? 1 : 2)}%`}
        />
        <StatTile
          label="Shards online"
          value={`${online.length} / ${shards.length}`}
        />
        <StatTile label="Gateway ping" value={formatMs(latestPing)} />
        <StatTile label="Servers" value={formatCompact(totalGuilds)} />
        {hasResources && (
          <>
            <StatTile
              label="CPU (avg/shard)"
              value={online.length ? formatPercent(avgCpu) : "—"}
            />
            <StatTile label="Memory" value={formatMemMb(totalMem)} />
          </>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Gateway ping</h2>
        {pingSeries.length > 1 ? (
          <MultiLineChart
            data={pingSeries}
            bucket={bucket}
            series={[
              { key: "avg", label: "Average", color: viz.commands },
              { key: "max", label: "Worst", color: viz.errors },
            ]}
          />
        ) : (
          <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Not enough snapshots with ping data in this period.
          </p>
        )}
      </div>

      {hasResources && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">
              CPU{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                (% of all cores)
              </span>
            </h2>
            {resourceSeries.length > 1 ? (
              <MultiLineChart
                data={resourceSeries}
                bucket={bucket}
                series={[
                  { key: "cpuAvg", label: "Average", color: viz.commands },
                  { key: "cpuMax", label: "Peak", color: viz.errors },
                ]}
              />
            ) : (
              <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Not enough snapshots with resource data in this period.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">
              Memory{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                (RSS, MB)
              </span>
            </h2>
            {resourceSeries.length > 1 ? (
              <MultiLineChart
                data={resourceSeries}
                bucket={bucket}
                series={[
                  { key: "memAvg", label: "Average", color: viz.joins },
                  { key: "memMax", label: "Peak", color: viz.errors },
                ]}
              />
            ) : (
              <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Not enough snapshots with resource data in this period.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-semibold">
          Shards
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-2 font-medium">Shard</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Servers</th>
              <th className="px-4 py-2 text-right font-medium">~Members</th>
              <th className="px-4 py-2 text-right font-medium">Ping</th>
              {hasResources && (
                <>
                  <th className="px-4 py-2 text-right font-medium">CPU</th>
                  <th className="px-4 py-2 text-right font-medium">Memory</th>
                </>
              )}
              <th className="px-4 py-2 text-right font-medium">Last snapshot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 tabular-nums">
            {shards.map((shard) => {
              const isOnline = now - shard.lastSeen < ONLINE_THRESHOLD_MS;
              return (
                <tr key={shard.shardId}>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    #{shard.shardId}
                    {shard.totalShards > 1 && (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {" "}
                        / {shard.totalShards}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        isOnline
                          ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400"
                      }
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`}
                        aria-hidden
                      />
                      {isOnline ? "online" : "offline"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {formatNumber(shard.guilds)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {shard.members > 0 ? formatCompact(shard.members) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">{formatMs(shard.ping)}</td>
                  {hasResources && (
                    <>
                      <td className="px-4 py-2.5 text-right">
                        {shard.mem > 0 ? formatPercent(shard.cpu) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {formatMemMb(shard.mem)}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2.5 text-right text-zinc-500 dark:text-zinc-400">
                    {formatRelative(shard.lastSeen)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
