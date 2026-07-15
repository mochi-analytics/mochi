import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MochiLogo } from "@/components/mochi-logo";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { mochiAttributionUrl } from "@/lib/brand";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { parseRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Public read-only stats page — no auth, addressed by unguessable share id. */
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ shareId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { shareId } = await params;
  if (!z.string().uuid().safeParse(shareId).success) notFound();

  const [bot] = await db
    .select({ id: bots.id, name: bots.name })
    .from(bots)
    .where(eq(bots.shareId, shareId))
    .limit(1);
  if (!bot) notFound();

  const range = parseRange((await searchParams).range);

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-semibold tracking-tight">
            {bot.name}
          </span>
          <span className="flex items-center gap-3">
            <a
              href={mochiAttributionUrl("share")}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              stats by <MochiLogo className="h-3.5 w-3.5" /> Mochi
            </a>
            <ThemeToggle />
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <OverviewDashboard
          botId={bot.id}
          range={range}
          emptyState={
            <p className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No data yet.
            </p>
          }
        />
      </main>
    </div>
  );
}
