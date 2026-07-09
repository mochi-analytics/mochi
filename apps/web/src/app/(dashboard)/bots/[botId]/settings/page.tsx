import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ApiKeysPanel } from "@/components/api-keys-panel";
import { DeleteBotButton } from "@/components/delete-bot-button";
import {
  RetentionForm,
  RotateSaltButton,
  SharePanel,
  TeamSharePanel,
} from "@/components/settings-panels";
import { getAccessibleBot } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, botSettings } from "@/lib/db/schema";
import { listTeamsForBot, listTeamsForUser } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default async function BotSettingsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { botId } = await params;
  const bot = await getAccessibleBot(botId, user);
  if (!bot) notFound();
  // Viewers have no settings to change; send them back to the dashboard.
  if (!bot.canWrite) redirect(`/bots/${bot.id}`);

  const [keys, [settings], sharedTeams, myTeams] = await Promise.all([
    db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.botId, bot.id))
      .orderBy(apiKeys.createdAt),
    db
      .select()
      .from(botSettings)
      .where(eq(botSettings.botId, bot.id))
      .limit(1),
    listTeamsForBot(bot.id),
    listTeamsForUser(user),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold">API keys</h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Your bot authenticates to the ingest API with these keys. The full
          key is shown only once at creation.
        </p>
        <ApiKeysPanel
          botId={bot.id}
          keys={keys.map((k) => ({
            ...k,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            revokedAt: k.revokedAt?.toISOString() ?? null,
          }))}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Team sharing</h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Every member of a shared team can see this bot&apos;s analytics.
          Members with the viewer role are read-only; everyone else can manage
          it too.
        </p>
        <TeamSharePanel
          botId={bot.id}
          sharedTeams={sharedTeams}
          myTeams={myTeams.map((t) => ({ id: t.id, name: t.name }))}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Public sharing</h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          A read-only overview dashboard anyone with the link can see.
          Disabling and re-enabling issues a new link.
        </p>
        <SharePanel botId={bot.id} shareId={bot.shareId} />
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Data retention</h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Events older than this are deleted by the daily cleanup job.
        </p>
        <RetentionForm
          botId={bot.id}
          retentionDays={settings?.retentionDays ?? 395}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Privacy</h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          User ids are hashed with a per-bot salt before storage. Rotating the
          salt anonymizes all history — unique-user counts stay usable, but
          past activity can never be linked to future activity.
        </p>
        <RotateSaltButton botId={bot.id} />
      </section>

      <section className="rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Deleting a bot removes its configuration and API keys permanently.
          Its events are removed by the next cleanup run.
        </p>
        <DeleteBotButton botId={bot.id} botName={bot.name} />
      </section>
    </div>
  );
}
