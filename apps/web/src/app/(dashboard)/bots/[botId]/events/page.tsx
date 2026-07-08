import { RangePicker } from "@/components/range-picker";
import { formatNumber, formatRelative } from "@/lib/format";
import { getCustomEventSummary, getRecentEvents, parseRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { botId } = await params;
  const range = parseRange((await searchParams).range);
  const [summary, recent] = await Promise.all([
    getCustomEventSummary(botId, range),
    getRecentEvents(botId, { types: ["custom"], limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <RangePicker current={range} />

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
                  <td className="px-4 py-2.5 font-mono text-xs">{event.name}</td>
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
