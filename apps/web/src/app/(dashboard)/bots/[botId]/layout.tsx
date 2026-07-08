import { notFound, redirect } from "next/navigation";
import { BotTabs } from "@/components/bot-tabs";
import { getAccessibleBot } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function BotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ botId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { botId } = await params;
  const bot = await getAccessibleBot(botId, user);
  if (!bot) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{bot.name}</h1>
          {!bot.canWrite && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Read-only
            </span>
          )}
        </div>
        {bot.discordApplicationId && (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            App {bot.discordApplicationId}
          </p>
        )}
      </div>
      <BotTabs botId={bot.id} canWrite={bot.canWrite} />
      {children}
    </div>
  );
}
