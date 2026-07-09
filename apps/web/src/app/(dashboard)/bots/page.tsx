import { Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateBotForm } from "@/components/create-bot-form";
import { listAccessibleBots } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";
import { listTeamsForUser } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default async function BotsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canCreate = user.role !== "viewer";
  const [rows, teams] = await Promise.all([
    listAccessibleBots(user),
    canCreate ? listTeamsForUser(user) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bots</h1>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {canCreate
            ? "No bots yet — add your first one below."
            : "No bots have been shared with you yet."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((bot) => (
            <li key={bot.id}>
              <Link
                href={`/bots/${bot.id}`}
                className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{bot.name}</span>
                  {bot.access === "team" && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <Users className="h-3 w-3" aria-hidden />
                      Shared
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {bot.discordApplicationId
                    ? `App ${bot.discordApplicationId}`
                    : "No application id"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canCreate && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Add a bot</h2>
          <CreateBotForm
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          />
        </div>
      )}
    </div>
  );
}
