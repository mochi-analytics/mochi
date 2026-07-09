import { viz } from "@/components/charts/theme";
import { ExportLinks } from "@/components/export-links";
import { RangePicker } from "@/components/range-picker";
import { getCurrentUser } from "@/lib/auth/session";
import { formatMs, formatNumber, formatPercent } from "@/lib/format";
import { getTopCommands, parseRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CommandsPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { botId } = await params;
  const user = await getCurrentUser();
  const range = parseRange((await searchParams).range, user?.defaultRange);
  const commands = await getTopCommands(botId, range);
  const maxUses = commands[0]?.uses ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <RangePicker current={range} />
        <ExportLinks botId={botId} data="commands" range={range} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium">Command</th>
              <th className="px-4 py-3 text-right font-medium">Uses</th>
              <th className="px-4 py-3 text-right font-medium">Users</th>
              <th className="px-4 py-3 text-right font-medium">Success</th>
              <th className="px-4 py-3 text-right font-medium">p50</th>
              <th className="px-4 py-3 text-right font-medium">p95</th>
              <th className="w-1/4 px-4 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 tabular-nums">
            {commands.map((command) => (
              <tr key={command.name}>
                <td className="px-4 py-2.5 font-mono text-xs">/{command.name}</td>
                <td className="px-4 py-2.5 text-right">{formatNumber(command.uses)}</td>
                <td className="px-4 py-2.5 text-right">{formatNumber(command.users)}</td>
                <td
                  className="px-4 py-2.5 text-right"
                  style={command.successRate < 95 ? { color: viz.deltaBad } : undefined}
                >
                  {formatPercent(command.successRate)}
                </td>
                <td className="px-4 py-2.5 text-right">{formatMs(command.p50)}</td>
                <td className="px-4 py-2.5 text-right">{formatMs(command.p95)}</td>
                <td className="px-4 py-2.5">
                  <div className="h-2 w-full rounded-sm bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-2 rounded-sm"
                      style={{
                        width: `${maxUses > 0 ? Math.max(1, (command.uses / maxUses) * 100) : 0}%`,
                        background: viz.commands,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {commands.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                  No commands recorded in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
