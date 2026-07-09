import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { viz } from "@/components/charts/theme";
import { RangePicker } from "@/components/range-picker";
import { StatTile } from "@/components/stat-tile";
import { getCurrentUser } from "@/lib/auth/session";
import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatRelative,
} from "@/lib/format";
import {
  RANGES,
  getErrorSeries,
  getErrorStats,
  getFailingCommands,
  getRecentEvents,
  getTopErrors,
  parseRange,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ErrorsPage({
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

  const [stats, series, topErrors, failingCommands, recent] =
    await Promise.all([
      getErrorStats(botId, range),
      getErrorSeries(botId, range),
      getTopErrors(botId, range),
      getFailingCommands(botId, range),
      getRecentEvents(botId, { types: ["error"], limit: 25 }),
    ]);

  const hasData =
    stats.errorEvents > 0 || stats.failedCommands > 0 || recent.length > 0;

  return (
    <div className="space-y-6">
      <RangePicker current={range} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Error events" value={formatCompact(stats.errorEvents)} />
        <StatTile
          label="Failed commands"
          value={formatCompact(stats.failedCommands)}
        />
        <StatTile label="Error rate" value={formatPercent(stats.errorRate)} />
        <StatTile
          label="Affected users"
          value={formatCompact(stats.affectedUsers)}
        />
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-10 text-center">
          <p className="font-medium">No errors in this period 🎉</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Track caught exceptions with{" "}
            <code className="font-mono text-xs">
              mochi.track({"{"} type: &quot;error&quot;, name: &quot;…&quot; {"}"})
            </code>{" "}
            and failed commands with <code className="font-mono text-xs">success: false</code>.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">Errors over time</h2>
            <MultiLineChart
              data={series}
              bucket={bucket}
              series={[
                { key: "failures", label: "Failed commands", color: viz.leaves },
                { key: "errors", label: "Error events", color: viz.errors },
              ]}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-semibold">
                Error events
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-500 dark:text-zinc-400">
                    <th className="px-4 py-2 font-medium">Error</th>
                    <th className="px-4 py-2 text-right font-medium">Count</th>
                    <th className="px-4 py-2 text-right font-medium">Users</th>
                    <th className="px-4 py-2 text-right font-medium">First seen</th>
                    <th className="px-4 py-2 text-right font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 tabular-nums">
                  {topErrors.map((error) => (
                    <tr key={error.name}>
                      <td className="max-w-48 truncate px-4 py-2.5 font-mono text-xs">
                        {error.name}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {formatNumber(error.count)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {formatNumber(error.users)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 dark:text-zinc-400">
                        {formatRelative(error.firstSeen)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 dark:text-zinc-400">
                        {formatRelative(error.lastSeen)}
                      </td>
                    </tr>
                  ))}
                  {topErrors.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400"
                      >
                        No error events in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-semibold">
                Failing commands
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-500 dark:text-zinc-400">
                    <th className="px-4 py-2 font-medium">Command</th>
                    <th className="px-4 py-2 text-right font-medium">Failures</th>
                    <th className="px-4 py-2 text-right font-medium">Uses</th>
                    <th className="px-4 py-2 text-right font-medium">Failure rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 tabular-nums">
                  {failingCommands.map((command) => (
                    <tr key={command.name}>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        /{command.name}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {formatNumber(command.failures)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {formatNumber(command.uses)}
                      </td>
                      <td
                        className="px-4 py-2.5 text-right"
                        style={
                          command.failureRate >= 10
                            ? { color: viz.deltaBad }
                            : undefined
                        }
                      >
                        {formatPercent(command.failureRate)}
                      </td>
                    </tr>
                  ))}
                  {failingCommands.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400"
                      >
                        No failed commands in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-semibold">
              Latest error events
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recent.map((event, index) => (
                <li key={index} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs">
                      {event.eventName}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatRelative(event.at)}
                    </span>
                  </div>
                  {event.metadata && (
                    <div className="mt-1 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {event.metadata}
                    </div>
                  )}
                </li>
              ))}
              {recent.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No recent error events.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
