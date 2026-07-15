import { eq } from "drizzle-orm";
import { clickhouse } from "@/lib/clickhouse";
import { db } from "@/lib/db";
import { botSettings, bots, users } from "@/lib/db/schema";
import { retentionCapFor } from "@/lib/deployment";
import type { Role } from "@/lib/admin";

/**
 * Deletes expired events per each bot's retention setting, plus all
 * ClickHouse rows belonging to bots that no longer exist in Postgres.
 * ClickHouse DELETE mutations are heavyweight, so this runs daily.
 *
 * On cloud, the owner's retention cap is applied here regardless of the
 * stored setting, so rows written before the cap existed (or before an
 * ownership change) still expire on schedule.
 */
export async function runRetentionCleanup(): Promise<void> {
  const rows = await db
    .select({
      botId: bots.id,
      retentionDays: botSettings.retentionDays,
      ownerRole: users.role,
    })
    .from(bots)
    .innerJoin(botSettings, eq(botSettings.botId, bots.id))
    .innerJoin(users, eq(users.id, bots.ownerUserId));

  for (const { botId, retentionDays, ownerRole } of rows) {
    const cap = retentionCapFor(ownerRole as Role);
    const days = cap !== null ? Math.min(retentionDays, cap) : retentionDays;
    const params = { botId, days };
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
