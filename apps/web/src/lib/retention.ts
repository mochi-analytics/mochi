import { eq } from "drizzle-orm";
import { clickhouse } from "@/lib/clickhouse";
import { db } from "@/lib/db";
import { botSettings, bots } from "@/lib/db/schema";

/**
 * Deletes expired events per each bot's retention setting, plus all
 * ClickHouse rows belonging to bots that no longer exist in Postgres.
 * ClickHouse DELETE mutations are heavyweight, so this runs daily.
 */
export async function runRetentionCleanup(): Promise<void> {
  const rows = await db
    .select({ botId: bots.id, retentionDays: botSettings.retentionDays })
    .from(bots)
    .innerJoin(botSettings, eq(botSettings.botId, bots.id));

  for (const { botId, retentionDays } of rows) {
    const params = { botId, days: retentionDays };
    await clickhouse.command({
      query: `ALTER TABLE events DELETE
              WHERE bot_id = {botId:UUID}
                AND created_at < now64(3) - INTERVAL {days:UInt32} DAY`,
      query_params: params,
    });
    await clickhouse.command({
      query: `ALTER TABLE guild_snapshots DELETE
              WHERE bot_id = {botId:UUID}
                AND created_at < now64(3) - INTERVAL {days:UInt32} DAY`,
      query_params: params,
    });
    await clickhouse.command({
      query: `ALTER TABLE events_daily DELETE
              WHERE bot_id = {botId:UUID}
                AND date < today() - {days:UInt32}`,
      query_params: params,
    });
  }

  // Orphaned data from deleted bots.
  const knownIds = rows.map((r) => r.botId);
  for (const table of ["events", "guild_snapshots", "events_daily"]) {
    await clickhouse.command({
      query:
        knownIds.length > 0
          ? `ALTER TABLE ${table} DELETE WHERE bot_id NOT IN {ids:Array(UUID)}`
          : `ALTER TABLE ${table} DELETE WHERE 1 = 1`,
      query_params: { ids: knownIds },
    });
  }
}
