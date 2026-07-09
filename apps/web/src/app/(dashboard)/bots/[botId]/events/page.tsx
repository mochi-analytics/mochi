import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { viz } from "@/components/charts/theme";
import { ExportLinks } from "@/components/export-links";
import { RangePicker } from "@/components/range-picker";
import { StatTile } from "@/components/stat-tile";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCompact, formatNumber, formatRelative } from "@/lib/format";
import {
  RANGES,
  type Range,
  getCustomEventSeries,
  getCustomEventStats,
  getCustomEventSummary,
  getEventMetaBreakdown,
  getEventMetaKeys,
  getRecentEvents,
  parseRange,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{ range?: string; event?: string; key?: string }>;
}) {
  const { botId } = await params;
  const user = await getCurrentUser();
  const search = await searchParams;
  const range = parseRange(search.range, user?.defaultRange);

  if (search.event) {
    return (
      <EventDetail
        botId={botId}
        range={range}
        name={search.event}
        metaKey={search.key}
      />
    );
  }

  const [summary, recent] = await Promise.all([
    getCustomEventSummary(botId, range),
    getRecentEvents(botId, { types: ["custom"], limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <RangePicker current={range} />
        <ExportLinks botId={botId} data="custom" range={range} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-semibold">
            Custom events
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 text-right font-medium">Count</th>
                <th className="px-4 py-2 text-right font-medium">Users</th>
                <th className="px-4 py-2 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 tabular-nums">
              {summary.map((event) => (
                <tr key={event.name}>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link
                      href={`?event=${encodeURIComponent(event.name)}&range=${range}`}
                      className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600 dark:decoration-zinc-600 dark:hover:decoration-zinc-300"
                    >
                      {event.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right">{formatNumber(event.count)}</td>
                  <td className="px-4 py-2.5 text-right">{formatNumber(event.users)}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 dark:text-zinc-400">
                    {formatRelative(event.lastSeen)}
                  </td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                    No custom events in this period. Send them with{" "}
                    <code className="font-mono text-xs">
                      mochi.track({"{"} type: &quot;custom&quot;, name: &quot;…&quot; {"}"})
                    </code>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-semibold">
            Latest custom events
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recent.map((event, index) => (
              <li key={index} className="px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{event.eventName}</span>
                  <span className="ml-auto shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatRelative(event.at)}
                  </span>
                </div>
                {event.metadata && event.metadata !== "" && (
                  <div className="mt-1 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {event.metadata}
                  </div>
                )}
              </li>
            ))}
            {recent.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Nothing yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Drill-down for one custom event: volume, meta keys, value breakdown. */
async function EventDetail({
  botId,
  range,
  name,
  metaKey,
}: {
  botId: string;
  range: Range;
  name: string;
  metaKey?: string;
}) {
  const { bucket } = RANGES[range];
  const [stats, series, metaKeys] = await Promise.all([
    getCustomEventStats(botId, name, range),
    getCustomEventSeries(botId, name, range),
    getEventMetaKeys(botId, name, range),
  ]);
  const activeKey =
    metaKey && metaKeys.some((k) => k.key === metaKey) ? metaKey : undefined;
  const breakdown = activeKey
    ? await getEventMetaBreakdown(botId, name, activeKey, range)
    : [];
  const maxCount = breakdown[0]?.count ?? 0;
  const baseHref = `?event=${encodeURIComponent(name)}&range=${range}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`?range=${range}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All events
        </Link>
        <h2 className="font-mono text-sm font-semibold">{name}</h2>
      </div>

      <RangePicker current={range} />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Count" value={formatCompact(stats.count)} />
        <StatTile label="Unique users" value={formatCompact(stats.users)} />
        <StatTile label="Servers" value={formatCompact(stats.guilds)} />
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold">Volume</h3>
        <TimeSeriesChart data={series} bucket={bucket} label={name} />
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
        <h3 className="text-sm font-semibold">Meta breakdown</h3>
        {metaKeys.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            This event has no <code className="font-mono text-xs">meta</code>{" "}
            keys in this period. Attach dimensions with{" "}
            <code className="font-mono text-xs">
              mochi.track({"{"} …, meta: {"{"} plan: &quot;gold&quot; {"}"} {"}"})
            </code>
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Pick a meta key to see its value distribution.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {metaKeys.map((key) => (
                <Link
                  key={key.key}
                  href={`${baseHref}&key=${encodeURIComponent(key.key)}`}
                  className={
                    key.key === activeKey
                      ? "rounded-md bg-zinc-900 px-2.5 py-1 font-mono text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "rounded-md border border-zinc-200 px-2.5 py-1 font-mono text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }
                >
                  {key.key}
                  <span className="ml-1.5 opacity-60">{formatCompact(key.uses)}</span>
                </Link>
              ))}
            </div>

            {activeKey && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-500 dark:text-zinc-400">
                      <th className="py-2 pr-4 font-medium">{activeKey}</th>
                      <th className="py-2 pr-4 text-right font-medium">Count</th>
                      <th className="py-2 pr-4 text-right font-medium">Users</th>
                      <th className="w-1/3 py-2" aria-hidden />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 tabular-nums">
                    {breakdown.map((row) => (
                      <tr key={row.value}>
                        <td className="max-w-64 truncate py-2.5 pr-4 font-mono text-xs">
                          {row.value}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          {formatNumber(row.count)}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          {formatNumber(row.users)}
                        </td>
                        <td className="py-2.5">
                          <div className="h-2 w-full rounded-sm bg-zinc-100 dark:bg-zinc-800">
                            <div
                              className="h-2 rounded-sm"
                              style={{
                                width: `${maxCount > 0 ? Math.max(1, (row.count / maxCount) * 100) : 0}%`,
                                background: viz.commands,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
