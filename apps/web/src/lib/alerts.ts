import { eq } from "drizzle-orm";
import { clickhouse } from "@/lib/clickhouse";
import { db } from "@/lib/db";
import { alertConfigs, alertStates, bots } from "@/lib/db/schema";
import { buildDigestEmbed, isDigestDue } from "@/lib/digest";
import {
  EMBED_COLORS,
  type DiscordEmbed,
  sendDiscordWebhook,
} from "@/lib/discord";
import { formatCompact, formatPercent } from "@/lib/format";
import { getOverviewStats, getTopCommands, getTopErrors } from "@/lib/queries";

/**
 * Alert sweep: evaluates every bot with an alert config against its rules and
 * posts Discord webhook messages. Runs every minute (instrumentation-node,
 * ALERTS=1). Rules are deliberately stateful-but-simple:
 *
 * - offline      fires once when snapshots stop, recovers once when they resume
 * - error_spike  fires at most once per hour while the failure rate is high
 * - guild_drop   fires at most once per day
 * - digest       Monday 00:00 UTC weekly summary (see lib/digest.ts)
 *
 * Decision functions are pure so the thresholds/cooldowns are unit-testable.
 */

export type AlertKind = "offline" | "error_spike" | "guild_drop" | "digest";

const ERROR_WINDOW_MINUTES = 15;
const ERROR_MIN_COMMANDS = 20;
const ERROR_COOLDOWN_MS = 60 * 60_000;
const GUILD_DROP_COOLDOWN_MS = 24 * 60 * 60_000;
const GUILD_DROP_MIN_PREVIOUS = 10;
/** Bots whose last snapshot is older than this are treated as decommissioned,
 * not offline — otherwise a bot that was shut down for good alerts forever. */
const OFFLINE_LOOKBACK_DAYS = 7;

export function decideOffline(input: {
  /** null = no snapshot inside the lookback window */
  minutesSinceLastSnapshot: number | null;
  thresholdMinutes: number;
  active: boolean;
}): "fire" | "recover" | "none" {
  const { minutesSinceLastSnapshot: minutes, thresholdMinutes, active } = input;
  if (minutes === null) return "none";
  if (minutes >= thresholdMinutes) return active ? "none" : "fire";
  return active ? "recover" : "none";
}

export function decideErrorSpike(input: {
  commands: number;
  failures: number;
  thresholdPct: number;
  lastFiredAt: Date | null;
  now: number;
  minCommands?: number;
  cooldownMs?: number;
}): boolean {
  const {
    commands,
    failures,
    thresholdPct,
    lastFiredAt,
    now,
    minCommands = ERROR_MIN_COMMANDS,
    cooldownMs = ERROR_COOLDOWN_MS,
  } = input;
  if (commands < minCommands) return false;
  if ((failures / commands) * 100 < thresholdPct) return false;
  return !lastFiredAt || now - lastFiredAt.getTime() >= cooldownMs;
}

export function decideGuildDrop(input: {
  current: number;
  previous: number;
  thresholdPct: number;
  lastFiredAt: Date | null;
  now: number;
  minPrevious?: number;
  cooldownMs?: number;
}): boolean {
  const {
    current,
    previous,
    thresholdPct,
    lastFiredAt,
    now,
    minPrevious = GUILD_DROP_MIN_PREVIOUS,
    cooldownMs = GUILD_DROP_COOLDOWN_MS,
  } = input;
  if (previous < minPrevious || current >= previous) return false;
  if (((previous - current) / previous) * 100 < thresholdPct) return false;
  return !lastFiredAt || now - lastFiredAt.getTime() >= cooldownMs;
}

async function chRows<T>(
  query: string,
  params: Record<string, unknown>,
): Promise<T[]> {
  const result = await clickhouse.query({
    query,
    query_params: params,
    format: "JSONEachRow",
  });
  return result.json<T>();
}

/** Minutes since the newest snapshot, or null if none in the lookback. */
async function minutesSinceLastSnapshot(botId: string): Promise<number | null> {
  const [row] = await chRows<{ last: string | null }>(
    `SELECT max(created_at) AS last FROM guild_snapshots
     WHERE bot_id = {botId:UUID}
       AND created_at >= now64(3) - INTERVAL {days:UInt32} DAY`,
    { botId, days: OFFLINE_LOOKBACK_DAYS },
  );
  if (!row?.last || row.last.startsWith("1970")) return null;
  const last = new Date(`${row.last.replace(" ", "T")}Z`).getTime();
  return (Date.now() - last) / 60_000;
}

async function errorWindow(botId: string) {
  const [row] = await chRows<{ commands: string; failures: string; errors: string }>(
    `SELECT countIf(event_type = 'command') AS commands,
            countIf(event_type = 'command' AND success = 0) AS failures,
            countIf(event_type = 'error') AS errors
     FROM events
     WHERE bot_id = {botId:UUID}
       AND created_at >= now64(3) - INTERVAL {minutes:UInt32} MINUTE`,
    { botId, minutes: ERROR_WINDOW_MINUTES },
  );
  return {
    commands: Number(row?.commands ?? 0),
    failures: Number(row?.failures ?? 0),
    errors: Number(row?.errors ?? 0),
  };
}

/** Summed per-shard guild count as of now vs. as of 24 hours ago. */
async function guildCounts(botId: string) {
  const totalAt = async (fromHours: number, toHours: number) => {
    const [row] = await chRows<{ total: string }>(
      `SELECT sum(g) AS total FROM (
         SELECT shard_id, argMax(guild_count, created_at) AS g
         FROM guild_snapshots
         WHERE bot_id = {botId:UUID}
           AND created_at >= now64(3) - INTERVAL {fromHours:UInt32} HOUR
           AND created_at < now64(3) - INTERVAL {toHours:UInt32} HOUR
         GROUP BY shard_id
       )`,
      { botId, fromHours, toHours },
    );
    return Number(row?.total ?? 0);
  };
  const [current, dayAgo] = await Promise.all([totalAt(24, 0), totalAt(72, 24)]);
  return { current, dayAgo };
}

type ConfigRow = typeof alertConfigs.$inferSelect & { botName: string };
type StateMap = Map<AlertKind, typeof alertStates.$inferSelect>;

async function setState(
  botId: string,
  kind: AlertKind,
  values: { active?: boolean; lastFiredAt?: Date },
) {
  await db
    .insert(alertStates)
    .values({ botId, kind, active: values.active ?? false, ...values })
    .onConflictDoUpdate({
      target: [alertStates.botId, alertStates.kind],
      set: values,
    });
}

async function sweepBot(config: ConfigRow, states: StateMap, now: number) {
  const send = (embed: DiscordEmbed) =>
    sendDiscordWebhook(config.webhookUrl, [
      { ...embed, timestamp: new Date(now).toISOString() },
    ]);

  if (config.offlineEnabled) {
    const minutes = await minutesSinceLastSnapshot(config.botId);
    const decision = decideOffline({
      minutesSinceLastSnapshot: minutes,
      thresholdMinutes: config.offlineAfterMinutes,
      active: states.get("offline")?.active ?? false,
    });
    if (decision === "fire") {
      await send({
        title: `🔴 ${config.botName} looks offline`,
        description: `No health snapshot received for ${Math.round(minutes ?? 0)} minutes (threshold: ${config.offlineAfterMinutes}).`,
        color: EMBED_COLORS.red,
      });
      await setState(config.botId, "offline", {
        active: true,
        lastFiredAt: new Date(now),
      });
    } else if (decision === "recover") {
      await send({
        title: `🟢 ${config.botName} is back online`,
        description: "Health snapshots are arriving again.",
        color: EMBED_COLORS.green,
      });
      await setState(config.botId, "offline", { active: false });
    }
  }

  if (config.errorSpikeEnabled) {
    const window = await errorWindow(config.botId);
    const fire = decideErrorSpike({
      commands: window.commands,
      failures: window.failures,
      thresholdPct: config.errorRatePct,
      lastFiredAt: states.get("error_spike")?.lastFiredAt ?? null,
      now,
    });
    if (fire) {
      const rate = (window.failures / window.commands) * 100;
      await send({
        title: `⚠️ ${config.botName}: command error spike`,
        description: `${formatPercent(rate)} of commands failed in the last ${ERROR_WINDOW_MINUTES} minutes (threshold: ${config.errorRatePct}%).`,
        color: EMBED_COLORS.amber,
        fields: [
          { name: "Commands", value: formatCompact(window.commands), inline: true },
          { name: "Failures", value: formatCompact(window.failures), inline: true },
          { name: "Error events", value: formatCompact(window.errors), inline: true },
        ],
      });
      await setState(config.botId, "error_spike", { lastFiredAt: new Date(now) });
    }
  }

  if (config.guildDropEnabled) {
    const { current, dayAgo } = await guildCounts(config.botId);
    const fire = decideGuildDrop({
      current,
      previous: dayAgo,
      thresholdPct: config.guildDropPct,
      lastFiredAt: states.get("guild_drop")?.lastFiredAt ?? null,
      now,
    });
    if (fire) {
      await send({
        title: `📉 ${config.botName}: server count dropped`,
        description: `${formatCompact(dayAgo)} → ${formatCompact(current)} servers in the last 24 hours (−${formatPercent(((dayAgo - current) / dayAgo) * 100)}).`,
        color: EMBED_COLORS.red,
      });
      await setState(config.botId, "guild_drop", { lastFiredAt: new Date(now) });
    }
  }

  if (
    config.digestEnabled &&
    isDigestDue(now, states.get("digest")?.lastFiredAt ?? null)
  ) {
    const [stats, topCommands, topErrors] = await Promise.all([
      getOverviewStats(config.botId, "7d"),
      getTopCommands(config.botId, "7d", 5),
      getTopErrors(config.botId, "7d", 3),
    ]);
    await send(buildDigestEmbed(config.botName, stats, topCommands, topErrors));
    await setState(config.botId, "digest", { lastFiredAt: new Date(now) });
  }
}

/** One pass over all configured bots. Never throws. */
export async function runAlertSweep(): Promise<void> {
  const now = Date.now();
  const configs = await db
    .select({ config: alertConfigs, botName: bots.name })
    .from(alertConfigs)
    .innerJoin(bots, eq(bots.id, alertConfigs.botId));
  if (configs.length === 0) return;

  const allStates = await db.select().from(alertStates);
  const statesByBot = new Map<string, StateMap>();
  for (const state of allStates) {
    const map = statesByBot.get(state.botId) ?? new Map();
    map.set(state.kind as AlertKind, state);
    statesByBot.set(state.botId, map);
  }

  for (const { config, botName } of configs) {
    try {
      await sweepBot(
        { ...config, botName },
        statesByBot.get(config.botId) ?? new Map(),
        now,
      );
    } catch (err) {
      console.error(`[mochi] alert sweep failed for bot ${config.botId}`, err);
    }
  }
}
