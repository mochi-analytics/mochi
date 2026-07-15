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

/**
 * Zero-fills missing buckets so charts don't silently skip quiet periods.
 * `shiftMs` moves raw buckets forward, aligning a previous-period series
 * with the current window for comparison overlays.
 */
function gapFill<T extends Record<string, number>>(
  raw: { bucket: string; [k: string]: unknown }[],
  hours: number,
  bucket: keyof typeof BUCKET_MS,
  fields: (keyof T & string)[],
  shiftMs = 0,
): ({ t: number } & T)[] {
  const step = BUCKET_MS[bucket];
  const byBucket = new Map<number, Record<string, number>>();
  for (const row of raw) {
    const entry: Record<string, number> = {};
    for (const field of fields) entry[field] = Number(row[field] ?? 0);
    byBucket.set(parseChDate(row.bucket) + shiftMs, entry);
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

/**
 * Overview stats for the range. `offsetHours` shifts the whole window back
 * (e.g. offsetHours = range hours → the immediately preceding period), which
 * powers the "vs previous period" deltas.
 */
export async function getOverviewStats(
  botId: string,
  range: Range,
  offsetHours = 0,
) {
  const { hours } = RANGES[range];
  const window = `created_at >= now64(3) - INTERVAL {fromHours:UInt32} HOUR
       AND created_at < now64(3) - INTERVAL {offsetHours:UInt32} HOUR`;
  const params = { botId, fromHours: hours + offsetHours, offsetHours };
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
       AND ${window}`,
    params,
  );
  const [growth] = await rows<{ joins: string; leaves: string }>(
    `SELECT countIf(event_type = 'guild_join') AS joins,
            countIf(event_type = 'guild_leave') AS leaves
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type IN ('guild_join', 'guild_leave')
       AND ${window}`,
    params,
  );
  const [guilds] = await rows<{ total: string }>(
    `SELECT sum(g) AS total FROM (
       SELECT shard_id, argMax(guild_count, created_at) AS g
       FROM guild_snapshots WHERE bot_id = {botId:UUID}
         AND created_at < now64(3) - INTERVAL {offsetHours:UInt32} HOUR
       GROUP BY shard_id
     )`,
    { botId, offsetHours },
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

/**
 * Command volume series. With `previous` the query covers the preceding
 * window and buckets are shifted forward onto the current one, so both
 * series share an x-axis in comparison overlays.
 */
export async function getCommandVolumeSeries(
  botId: string,
  range: Range,
  previous = false,
) {
  const { hours, bucket } = RANGES[range];
  const raw = await rows<{ bucket: string; value: string }>(
    `SELECT ${BUCKET_FN[bucket]}(created_at) AS bucket, count() AS value
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'command'
       AND created_at >= now64(3) - INTERVAL {fromHours:UInt32} HOUR
       AND created_at < now64(3) - INTERVAL {offsetHours:UInt32} HOUR
     GROUP BY bucket ORDER BY bucket`,
    {
      botId,
      fromHours: previous ? hours * 2 : hours,
      offsetHours: previous ? hours : 0,
    },
  );
  return gapFill<{ value: number }>(
    raw,
    hours,
    bucket,
    ["value"],
    previous ? hours * 3_600_000 : 0,
  );
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

/** Latest summed per-shard guild count (badges, widgets). */
export async function getCurrentGuildCount(botId: string): Promise<number> {
  const [row] = await rows<{ total: string }>(
    `SELECT sum(g) AS total FROM (
       SELECT shard_id, argMax(guild_count, created_at) AS g
       FROM guild_snapshots WHERE bot_id = {botId:UUID}
       GROUP BY shard_id
     )`,
    { botId },
  );
  return Number(row?.total ?? 0);
}

/** Command count + unique users in range (badges, widgets). */
export async function getCommandTotals(botId: string, range: Range) {
  const { hours } = RANGES[range];
  const [row] = await rows<{ commands: string; users: string }>(
    `SELECT count() AS commands, uniqIf(user_hash, ${NO_USER}) AS users
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'command'
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR`,
    { botId, hours },
  );
  return {
    commands: Number(row?.commands ?? 0),
    users: Number(row?.users ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Errors

export async function getErrorStats(botId: string, range: Range) {
  const { hours } = RANGES[range];
  const [row] = await rows<{
    errors: string;
    failures: string;
    commands: string;
    users: string;
  }>(
    `SELECT countIf(event_type = 'error') AS errors,
            countIf(event_type = 'command' AND success = 0) AS failures,
            countIf(event_type = 'command') AS commands,
            uniqIf(user_hash, (event_type = 'error' OR success = 0) AND ${NO_USER}) AS users
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type IN ('command', 'error')
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR`,
    { botId, hours },
  );
  const commands = Number(row?.commands ?? 0);
  const failures = Number(row?.failures ?? 0);
  return {
    errorEvents: Number(row?.errors ?? 0),
    failedCommands: failures,
    errorRate: commands > 0 ? (failures / commands) * 100 : 0,
    affectedUsers: Number(row?.users ?? 0),
  };
}

export async function getErrorSeries(botId: string, range: Range) {
  const { hours, bucket } = RANGES[range];
  const raw = await rows<{ bucket: string; errors: string; failures: string }>(
    `SELECT ${BUCKET_FN[bucket]}(created_at) AS bucket,
            countIf(event_type = 'error') AS errors,
            countIf(event_type = 'command' AND success = 0) AS failures
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type IN ('command', 'error')
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY bucket ORDER BY bucket`,
    { botId, hours },
  );
  return gapFill<{ errors: number; failures: number }>(raw, hours, bucket, [
    "errors",
    "failures",
  ]);
}

/** `error`-type events grouped by name. */
export async function getTopErrors(botId: string, range: Range, limit = 50) {
  const { hours } = RANGES[range];
  const raw = await rows<{
    name: string;
    count: string;
    users: string;
    firstSeen: string;
    lastSeen: string;
  }>(
    `SELECT event_name AS name, count() AS count,
            uniqIf(user_hash, ${NO_USER}) AS users,
            min(created_at) AS firstSeen, max(created_at) AS lastSeen
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'error'
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY name ORDER BY count DESC LIMIT {limit:UInt32}`,
    { botId, hours, limit },
  );
  return raw.map((row) => ({
    name: row.name,
    count: Number(row.count),
    users: Number(row.users),
    firstSeen: parseChDate(row.firstSeen),
    lastSeen: parseChDate(row.lastSeen),
  }));
}

/** Commands ranked by failure count (only those that failed at least once). */
export async function getFailingCommands(
  botId: string,
  range: Range,
  limit = 20,
) {
  const { hours } = RANGES[range];
  const raw = await rows<{ name: string; uses: string; failures: string }>(
    `SELECT event_name AS name, count() AS uses,
            countIf(success = 0) AS failures
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'command'
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY name HAVING failures > 0
     ORDER BY failures DESC LIMIT {limit:UInt32}`,
    { botId, hours, limit },
  );
  return raw.map((row) => ({
    name: row.name,
    uses: Number(row.uses),
    failures: Number(row.failures),
    failureRate: (Number(row.failures) / Number(row.uses)) * 100,
  }));
}

// ---------------------------------------------------------------------------
// Health: shards, ping, uptime

export async function getShardStatuses(botId: string) {
  const raw = await rows<{
    shardId: number;
    guilds: string;
    members: string;
    ping: string;
    cpu: string;
    mem: string;
    totalShards: number;
    lastSeen: string;
  }>(
    `SELECT shard_id AS shardId,
            argMax(guild_count, created_at) AS guilds,
            argMax(approximate_member_sum, created_at) AS members,
            argMax(ws_ping_ms, created_at) AS ping,
            argMax(cpu_pct, created_at) AS cpu,
            argMax(mem_rss_mb, created_at) AS mem,
            argMax(total_shards, created_at) AS totalShards,
            max(created_at) AS lastSeen
     FROM guild_snapshots
     WHERE bot_id = {botId:UUID}
       AND created_at >= now64(3) - INTERVAL 7 DAY
     GROUP BY shardId ORDER BY shardId`,
    { botId },
  );
  return raw.map((row) => ({
    shardId: row.shardId,
    guilds: Number(row.guilds),
    members: Number(row.members),
    ping: Number(row.ping),
    cpu: Number(row.cpu),
    mem: Number(row.mem),
    totalShards: Number(row.totalShards),
    lastSeen: parseChDate(row.lastSeen),
  }));
}

/**
 * Average/peak process CPU (0-100 across all cores) and resident memory (MB)
 * per bucket. Rows that never reported resources land as 0/0 on ingest, so we
 * exclude them: a snapshot with mem_rss_mb = 0 predates or opts out of resource
 * reporting and would otherwise drag the average toward zero. No zero-fill —
 * gaps mean "no data", consistent with the ping series.
 */
export async function getResourceSeries(botId: string, range: Range) {
  const { hours, bucket } = RANGES[range];
  const raw = await rows<{
    bucket: string;
    cpuAvg: string;
    cpuMax: string;
    memAvg: string;
    memMax: string;
  }>(
    `SELECT ${BUCKET_FN[bucket]}(created_at) AS bucket,
            round(avg(cpu_pct), 1) AS cpuAvg, round(max(cpu_pct), 1) AS cpuMax,
            round(avg(mem_rss_mb)) AS memAvg, max(mem_rss_mb) AS memMax
     FROM guild_snapshots
     WHERE bot_id = {botId:UUID} AND mem_rss_mb > 0
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY bucket ORDER BY bucket`,
    { botId, hours },
  );
  return raw.map((row) => ({
    t: parseChDate(row.bucket),
    cpuAvg: Number(row.cpuAvg),
    cpuMax: Number(row.cpuMax),
    memAvg: Number(row.memAvg),
    memMax: Number(row.memMax),
  }));
}

/** Average/worst websocket ping per bucket. No zero-fill: gaps mean no data. */
export async function getPingSeries(botId: string, range: Range) {
  const { hours, bucket } = RANGES[range];
  const raw = await rows<{ bucket: string; avg: string; max: string }>(
    `SELECT ${BUCKET_FN[bucket]}(created_at) AS bucket,
            round(avg(ws_ping_ms)) AS avg, max(ws_ping_ms) AS max
     FROM guild_snapshots
     WHERE bot_id = {botId:UUID} AND ws_ping_ms > 0
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY bucket ORDER BY bucket`,
    { botId, hours },
  );
  return raw.map((row) => ({
    t: parseChDate(row.bucket),
    avg: Number(row.avg),
    max: Number(row.max),
  }));
}

const UPTIME_INTERVAL_MS = 3_600_000;

/**
 * Uptime = share of 1-hour intervals containing ≥1 snapshot (the SDKs default
 * to hourly snapshots, so finer buckets would report false downtime), measured
 * from the later of (range start, first snapshot in range) so a bot
 * instrumented mid-range isn't penalized for time before it existed. Null when
 * there are no snapshots at all in the range.
 */
export async function getUptime(botId: string, range: Range) {
  const { hours } = RANGES[range];
  const [row] = await rows<{ up: string; first: string }>(
    `SELECT uniqExact(toStartOfHour(created_at)) AS up,
            min(created_at) AS first
     FROM guild_snapshots
     WHERE bot_id = {botId:UUID}
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR`,
    { botId, hours },
  );
  const up = Number(row?.up ?? 0);
  if (up === 0) return null;
  const now = Date.now();
  const start = Math.max(now - hours * 3_600_000, parseChDate(row.first));
  const intervals =
    Math.floor(now / UPTIME_INTERVAL_MS) -
    Math.floor(start / UPTIME_INTERVAL_MS) +
    1;
  return Math.min(100, (up / intervals) * 100);
}

// ---------------------------------------------------------------------------
// Custom event explorer

export async function getCustomEventStats(
  botId: string,
  name: string,
  range: Range,
) {
  const { hours } = RANGES[range];
  const [row] = await rows<{ count: string; users: string; guilds: string }>(
    `SELECT count() AS count,
            uniqIf(user_hash, ${NO_USER}) AS users,
            uniqIf(guild_id, guild_id != 0) AS guilds
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'custom'
       AND event_name = {name:String}
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR`,
    { botId, name, hours },
  );
  return {
    count: Number(row?.count ?? 0),
    users: Number(row?.users ?? 0),
    guilds: Number(row?.guilds ?? 0),
  };
}

export async function getCustomEventSeries(
  botId: string,
  name: string,
  range: Range,
) {
  const { hours, bucket } = RANGES[range];
  const raw = await rows<{ bucket: string; value: string }>(
    `SELECT ${BUCKET_FN[bucket]}(created_at) AS bucket, count() AS value
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'custom'
       AND event_name = {name:String}
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY bucket ORDER BY bucket`,
    { botId, name, hours },
  );
  return gapFill<{ value: number }>(raw, hours, bucket, ["value"]);
}

/** Top-level keys seen in this event's meta, by frequency. */
export async function getEventMetaKeys(
  botId: string,
  name: string,
  range: Range,
  limit = 20,
) {
  const { hours } = RANGES[range];
  const raw = await rows<{ key: string; uses: string }>(
    `SELECT key, count() AS uses FROM (
       SELECT arrayJoin(JSONExtractKeys(metadata)) AS key
       FROM events
       WHERE bot_id = {botId:UUID} AND event_type = 'custom'
         AND event_name = {name:String} AND metadata != ''
         AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     ) GROUP BY key ORDER BY uses DESC LIMIT {limit:UInt32}`,
    { botId, name, hours, limit },
  );
  return raw.map((row) => ({ key: row.key, uses: Number(row.uses) }));
}

/** Value distribution of one meta key for one custom event. */
export async function getEventMetaBreakdown(
  botId: string,
  name: string,
  key: string,
  range: Range,
  limit = 25,
) {
  const { hours } = RANGES[range];
  const raw = await rows<{ value: string; count: string; users: string }>(
    `SELECT JSONExtractRaw(metadata, {key:String}) AS value,
            count() AS count,
            uniqIf(user_hash, ${NO_USER}) AS users
     FROM events
     WHERE bot_id = {botId:UUID} AND event_type = 'custom'
       AND event_name = {name:String}
       AND JSONHas(metadata, {key:String})
       AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
     GROUP BY value ORDER BY count DESC LIMIT {limit:UInt32}`,
    { botId, name, key, hours, limit },
  );
  return raw.map((row) => ({
    // Raw JSON token: strip quotes from plain strings for display.
    value: /^".*"$/.test(row.value)
      ? row.value.slice(1, -1)
      : row.value,
    count: Number(row.count),
    users: Number(row.users),
  }));
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
