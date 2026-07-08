import { clickhouse } from "@/lib/clickhouse";

/**
 * Dashboard read queries. All hit the raw `events` table — fine well past
 * tens of millions of rows given the (bot_id, event_type, created_at) sort
 * key. The events_daily rollup accumulates for when long ranges need it.
 *
 * Counts come back as strings (ClickHouse quotes UInt64 in JSON to protect
 * snowflakes), hence the Number() conversions on aggregate fields.
 */

export type Range = "24h" | "7d" | "30d" | "90d";

export const RANGES: Record<
  Range,
  { hours: number; bucket: "hour" | "day"; label: string }
> = {
  "24h": { hours: 24, bucket: "hour", label: "Last 24 hours" },
  "7d": { hours: 168, bucket: "day", label: "Last 7 days" },
  "30d": { hours: 720, bucket: "day", label: "Last 30 days" },
  "90d": { hours: 2160, bucket: "day", label: "Last 90 days" },
};

export function parseRange(
  value: string | undefined,
  fallback: Range = "30d",
): Range {
  return value && value in RANGES ? (value as Range) : fallback;
}

const BUCKET_FN = { hour: "toStartOfHour", day: "toStartOfDay", minute: "toStartOfMinute" } as const;
const BUCKET_MS = { hour: 3_600_000, day: 86_400_000, minute: 60_000 } as const;

const NO_USER = "user_hash != toFixedString('', 16)";

async function rows<T>(query: string, params: Record<string, unknown>): Promise<T[]> {
  const result = await clickhouse.query({
    query,
    query_params: params,
    format: "JSONEachRow",
  });
  return result.json<T>();
}

function parseChDate(value: string): number {
  return new Date(`${value.replace(" ", "T")}Z`).getTime();
}

/** Zero-fills missing buckets so charts don't silently skip quiet periods. */
function gapFill<T extends Record<string, number>>(
  raw: { bucket: string; [k: string]: unknown }[],
  hours: number,
  bucket: keyof typeof BUCKET_MS,
  fields: (keyof T & string)[],
): ({ t: number } & T)[] {
  const step = BUCKET_MS[bucket];
  const byBucket = new Map<number, Record<string, number>>();
  for (const row of raw) {
    const entry: Record<string, number> = {};
    for (const field of fields) entry[field] = Number(row[field] ?? 0);
    byBucket.set(parseChDate(row.bucket), entry);
  }
  const now = Date.now();
  const start = Math.floor((now - hours * 3_600_000) / step) * step;
  const out: ({ t: number } & T)[] = [];
  for (let t = start; t <= now; t += step) {
    const entry = byBucket.get(t);
    const point: Record<string, number> = { t };
    for (const field of fields) point[field] = entry?.[field] ?? 0;
    out.push(point as { t: number } & T);
  }
  return out;
}

export async function getOverviewStats(botId: string, range: Range) {
  const { hours } = RANGES[range];
  const [commands] = await rows<{
    commands: string;
    users: string;
    failures: string;
    p95: number | null;
  }>(
    `SELECT count() AS commands,
            uniqIf(user_hash, ${NO_USER}) AS users,
            countIf(success = 0) AS failures,
            round(quantileIf(0.95)(duration_ms, duration_ms > 0)) AS p95
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'command'
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR`,
    { botId, hours },
  );
  const [growth] = await rows<{ joins: string; leaves: string }>(
    `SELECT countIf(event_type = 'guild_join') AS joins,
            countIf(event_type = 'guild_leave') AS leaves
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type IN ('guild_join', 'guild_leave')
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR`,
    { botId, hours },
  );
  const [guilds] = await rows<{ total: string }>(
    `SELECT sum(g) AS total FROM (
       SELECT shard_id, argMax(guild_count, created_at) AS g
       FROM guild_snapshots WHERE bot_id = {botId:UUID}
       GROUP BY shard_id
     )`,
    { botId },
  );

  const commandCount = Number(commands?.commands ?? 0);
  const failures = Number(commands?.failures ?? 0);
  return {
    guildCount: Number(guilds?.total ?? 0),
    commands: commandCount,
    uniqueUsers: Number(commands?.users ?? 0),
    errorRate: commandCount > 0 ? (failures / commandCount) * 100 : 0,
    p95Ms: Number(commands?.p95 ?? 0),
    joins: Number(growth?.joins ?? 0),
    leaves: Number(growth?.leaves ?? 0),
  };
}

export async function getCommandVolumeSeries(botId: string, range: Range) {
  const { hours, bucket } = RANGES[range];
  const raw = await rows<{ bucket: string; value: string }>(
    `SELECT ${BUCKET_FN[bucket]}(created_at) AS bucket, count() AS value
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'command'
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY bucket ORDER BY bucket`,
    { botId, hours },
  );
  return gapFill<{ value: number }>(raw, hours, bucket, ["value"]);
}

export async function getGuildCountSeries(botId: string, range: Range) {
  const { hours, bucket } = RANGES[range];
  const raw = await rows<{ bucket: string; value: string }>(
    `SELECT bucket, sum(g) AS value FROM (
       SELECT ${BUCKET_FN[bucket]}(created_at) AS bucket, shard_id,
              max(guild_count) AS g
       FROM guild_snapshots
       WHERE bot_id = {botId:UUID}
         AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
       GROUP BY bucket, shard_id
     ) GROUP BY bucket ORDER BY bucket`,
    { botId, hours },
  );
  // No zero-fill: a missing snapshot bucket means "no data", not zero guilds.
  return raw.map((row) => ({ t: parseChDate(row.bucket), value: Number(row.value) }));
}

export async function getJoinsLeavesSeries(botId: string, range: Range) {
  const { hours, bucket } = RANGES[range];
  const raw = await rows<{ bucket: string; joins: string; leaves: string }>(
    `SELECT ${BUCKET_FN[bucket]}(created_at) AS bucket,
            countIf(event_type = 'guild_join') AS joins,
            countIf(event_type = 'guild_leave') AS leaves
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type IN ('guild_join', 'guild_leave')
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY bucket ORDER BY bucket`,
    { botId, hours },
  );
  return gapFill<{ joins: number; leaves: number }>(raw, hours, bucket, [
    "joins",
    "leaves",
  ]);
}

export async function getTopCommands(botId: string, range: Range, limit = 50) {
  const { hours } = RANGES[range];
  const raw = await rows<{
    name: string;
    uses: string;
    users: string;
    successRate: number;
    p50: number | null;
    p95: number | null;
  }>(
    `SELECT event_name AS name,
            count() AS uses,
            uniqIf(user_hash, ${NO_USER}) AS users,
            round(100 * countIf(success = 1) / count(), 1) AS successRate,
            round(quantileIf(0.5)(duration_ms, duration_ms > 0)) AS p50,
            round(quantileIf(0.95)(duration_ms, duration_ms > 0)) AS p95
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'command'
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY name ORDER BY uses DESC LIMIT {limit:UInt32}`,
    { botId, hours, limit },
  );
  return raw.map((row) => ({
    name: row.name,
    uses: Number(row.uses),
    users: Number(row.users),
    successRate: Number(row.successRate ?? 100),
    p50: Number(row.p50 ?? 0),
    p95: Number(row.p95 ?? 0),
  }));
}

export async function getTopGuilds(botId: string, range: Range, limit = 20) {
  const { hours } = RANGES[range];
  const raw = await rows<{
    guildId: string;
    events: string;
    users: string;
    lastSeen: string;
  }>(
    `SELECT toString(guild_id) AS guildId,
            count() AS events,
            uniqIf(user_hash, ${NO_USER}) AS users,
            max(created_at) AS lastSeen
     FROM events
     WHERE bot_id = {botId:UUID} AND guild_id != 0
       AND event_type IN ('command', 'custom')
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY guildId ORDER BY events DESC LIMIT {limit:UInt32}`,
    { botId, hours, limit },
  );
  return raw.map((row) => ({
    guildId: row.guildId,
    events: Number(row.events),
    users: Number(row.users),
    lastSeen: parseChDate(row.lastSeen),
  }));
}

export async function getRecentGuildChanges(botId: string, limit = 20) {
  const raw = await rows<{
    eventType: string;
    guildId: string;
    metadata: string;
    at: string;
  }>(
    `SELECT event_type AS eventType, toString(guild_id) AS guildId,
            metadata, created_at AS at
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type IN ('guild_join', 'guild_leave')
     ORDER BY created_at DESC LIMIT {limit:UInt32}`,
    { botId, limit },
  );
  return raw.map((row) => ({
    type: row.eventType as "guild_join" | "guild_leave",
    guildId: row.guildId,
    metadata: row.metadata,
    at: parseChDate(row.at),
  }));
}

export async function getCustomEventSummary(botId: string, range: Range) {
  const { hours } = RANGES[range];
  const raw = await rows<{
    name: string;
    count: string;
    users: string;
    lastSeen: string;
  }>(
    `SELECT event_name AS name, count() AS count,
            uniqIf(user_hash, ${NO_USER}) AS users,
            max(created_at) AS lastSeen
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'custom'
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY name ORDER BY count DESC LIMIT 100`,
    { botId, hours },
  );
  return raw.map((row) => ({
    name: row.name,
    count: Number(row.count),
    users: Number(row.users),
    lastSeen: parseChDate(row.lastSeen),
  }));
}

export async function getRecentEvents(
  botId: string,
  options: { types?: string[]; sinceMinutes?: number; limit?: number } = {},
) {
  const { types, sinceMinutes = 0, limit = 50 } = options;
  const raw = await rows<{
    eventType: string;
    eventName: string;
    guildId: string;
    channelType: string;
    success: number;
    durationMs: number;
    metadata: string;
    at: string;
  }>(
    `SELECT event_type AS eventType, event_name AS eventName,
            toString(guild_id) AS guildId, channel_type AS channelType,
            success, duration_ms AS durationMs, metadata, created_at AS at
     FROM events
     WHERE bot_id = {botId:UUID}
       ${types ? "AND event_type IN {types:Array(String)}" : ""}
       ${sinceMinutes > 0 ? "AND created_at >= now64(3) - INTERVAL {sinceMinutes:UInt32} MINUTE" : ""}
     ORDER BY created_at DESC LIMIT {limit:UInt32}`,
    { botId, types, sinceMinutes, limit },
  );
  return raw.map((row) => ({ ...row, at: parseChDate(row.at) }));
}

export async function getRealtimeSeries(botId: string, minutes = 30) {
  const raw = await rows<{ bucket: string; value: string }>(
    `SELECT toStartOfMinute(created_at) AS bucket, count() AS value
     FROM events
     WHERE bot_id = {botId:UUID}
       AND created_at >= now64(3) - INTERVAL {minutes:UInt32} MINUTE
     GROUP BY bucket ORDER BY bucket`,
    { botId, minutes },
  );
  return gapFill<{ value: number }>(raw, minutes / 60, "minute", ["value"]);
}
