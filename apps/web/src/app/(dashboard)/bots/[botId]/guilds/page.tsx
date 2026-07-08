import { RangePicker } from "@/components/range-picker";
import { getCurrentUser } from "@/lib/auth/session";
import { formatNumber, formatRelative } from "@/lib/format";
import { getRecentGuildChanges, getTopGuilds, parseRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function GuildsPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { botId } = await params;
  const user = await getCurrentUser();
  const range = parseRange((await searchParams).range, user?.defaultRange);
  const [topGuilds, changes] = await Promise.all([
    getTopGuilds(botId, range),
    getRecentGuildChanges(botId),
  ]);

  return (
    <div className="space-y-6">
      <RangePicker current={range} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm lg:col-span-2">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-semibold">
            Most active servers
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="px-4 py-2 font-medium">Server id</th>
                <th className="px-4 py-2 text-right font-medium">Events</th>
                <th className="px-4 py-2 text-right font-medium">Users</th>
                <th className="px-4 py-2 text-right font-medium">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 tabular-nums">
              {topGuilds.map((guild) => (
                <tr key={guild.guildId}>
                  <td className="px-4 py-2.5 font-mono text-xs">{guild.guildId}</td>
                  <td className="px-4 py-2.5 text-right">{formatNumber(guild.events)}</td>
                  <td className="px-4 py-2.5 text-right">{formatNumber(guild.users)}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 dark:text-zinc-400">
                    {formatRelative(guild.lastSeen)}
                  </td>
                </tr>
              ))}
              {topGuilds.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                    No server activity in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-semibold">
            Recent joins & leaves
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {changes.map((change, index) => (
              <li key={index} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={
                    change.type === "guild_join"
                      ? { background: "var(--badge-join-bg)", color: "var(--badge-join-fg)" }
                      : { background: "var(--badge-leave-bg)", color: "var(--badge-leave-fg)" }
                  }
                >
                  {change.type === "guild_join" ? "joined" : "left"}
                </span>
                <span className="truncate font-mono text-xs">{change.guildId}</span>
                <span className="ml-auto shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatRelative(change.at)}
                </span>
              </li>
            ))}
            {changes.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No joins or leaves recorded yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
