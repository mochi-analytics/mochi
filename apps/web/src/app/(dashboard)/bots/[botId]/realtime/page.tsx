import { AutoRefresh } from "@/components/auto-refresh";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { formatMs, formatRelative } from "@/lib/format";
import { getRealtimeSeries, getRecentEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RealtimePage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const [series, events] = await Promise.all([
    getRealtimeSeries(botId, 30),
    getRecentEvents(botId, { sinceMinutes: 30, limit: 50 }),
  ]);
  const total = series.reduce((sum, point) => sum + point.value, 0);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={10_000} />

      <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {total.toLocaleString("en")} events in the last 30 minutes · updates every 10s
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Events per minute</h2>
        <TimeSeriesChart data={series} bucket="minute" label="Events" height={200} />
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-semibold">
          Live feed
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {events.map((event, index) => (
            <li key={index} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-20 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                {event.eventType}
              </span>
              <span className="truncate font-mono text-xs">
                {event.eventName || (event.guildId !== "0" ? event.guildId : "—")}
              </span>
              {event.eventType === "command" && (
                <>
                  {event.success === 0 && (
                    <span className="shrink-0 rounded-full bg-red-50 dark:bg-red-950 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                      failed
                    </span>
                  )}
                  {event.durationMs > 0 && (
                    <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                      {formatMs(event.durationMs)}
                    </span>
                  )}
                </>
              )}
              <span className="ml-auto shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                {formatRelative(event.at)}
              </span>
            </li>
          ))}
          {events.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No events in the last 30 minutes.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
