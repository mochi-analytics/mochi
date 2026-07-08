import Link from "next/link";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { parseRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BotOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { botId } = await params;
  const user = await getCurrentUser();
  const range = parseRange((await searchParams).range, user?.defaultRange);

  return (
    <OverviewDashboard
      botId={botId}
      range={range}
      emptyState={
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-10 text-center">
          <p className="font-medium">No data yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Create an API key in{" "}
            <Link href={`/bots/${botId}/settings`} className="underline">
              settings
            </Link>{" "}
            and point your bot&apos;s Mochi SDK at this instance. Charts appear
            as soon as events arrive.
          </p>
        </div>
      }
    />
  );
}
