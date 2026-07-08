import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@clickhouse/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

/**
 * Seeds a "Demo Bot" with ~30 days of plausible activity so the dashboards
 * have something to render. Idempotent-ish: re-running adds a fresh demo bot.
 *
 * Usage: pnpm --filter @mochi/web seed [--events-per-day 3000]
 */

const flagIndex = process.argv.indexOf("--events-per-day");
const EVENTS_PER_DAY =
  flagIndex === -1 ? 3000 : Number(process.argv[flagIndex + 1]) || 3000;
const DAYS = 30;

const COMMANDS: { name: string; weight: number; errorRate: number; avgMs: number }[] = [
  { name: "play", weight: 30, errorRate: 0.04, avgMs: 450 },
  { name: "skip", weight: 14, errorRate: 0.01, avgMs: 120 },
  { name: "queue", weight: 10, errorRate: 0.01, avgMs: 180 },
  { name: "help", weight: 8, errorRate: 0.0, avgMs: 60 },
  { name: "ban", weight: 3, errorRate: 0.08, avgMs: 300 },
  { name: "kick", weight: 3, errorRate: 0.06, avgMs: 280 },
  { name: "rank", weight: 12, errorRate: 0.02, avgMs: 220 },
  { name: "daily", weight: 9, errorRate: 0.01, avgMs: 150 },
  { name: "profile", weight: 6, errorRate: 0.02, avgMs: 200 },
  { name: "config", weight: 2, errorRate: 0.1, avgMs: 400 },
  { name: "lyrics", weight: 3, errorRate: 0.15, avgMs: 900 },
];
const TOTAL_WEIGHT = COMMANDS.reduce((sum, c) => sum + c.weight, 0);

const CUSTOM_EVENTS = ["premium_purchased", "playlist_created", "level_up"];

function pickCommand() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const cmd of COMMANDS) {
    roll -= cmd.weight;
    if (roll <= 0) return cmd;
  }
  return COMMANDS[0];
}

function snowflake(): string {
  return String(BigInt(Math.floor(Math.random() * 1e15)) + 100000000000000000n);
}

function chTs(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

function hashUser(userId: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${userId}`).digest("hex").slice(0, 16);
}

async function main() {
  const pg = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(pg, { schema });
  const ch = createClient({
    url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
    username: process.env.CLICKHOUSE_USER ?? "mochi",
    password: process.env.CLICKHOUSE_PASSWORD ?? "",
    database: process.env.CLICKHOUSE_DB ?? "mochi",
  });

  const owner = (await db.select().from(schema.users).limit(1))[0];
  if (!owner) {
    throw new Error("No users exist — run the app and complete setup first.");
  }

  const salt = randomBytes(16).toString("hex");
  const [bot] = await db
    .insert(schema.bots)
    .values({
      name: `Demo Bot ${new Date().toISOString().slice(0, 10)}`,
      discordApplicationId: snowflake(),
      ownerUserId: owner.id,
    })
    .returning();
  await db.insert(schema.botSettings).values({ botId: bot.id, userHashSalt: salt });
  console.log(`created bot "${bot.name}" (${bot.id}) owned by ${owner.username}`);

  // Stable populations so uniques and top-guilds look realistic.
  const guilds = Array.from({ length: 120 }, () => ({
    id: snowflake(),
    // Zipf-ish activity: a few very busy guilds, a long quiet tail.
    activity: Math.random() ** 2.5,
  }));
  const users = Array.from({ length: 2500 }, () => snowflake());

  const now = Date.now();
  const start = now - DAYS * 86_400_000;
  let guildCount = 95; // grows to ~120 over the window

  const events: Record<string, unknown>[] = [];
  const snapshots: Record<string, unknown>[] = [];

  for (let day = 0; day < DAYS; day++) {
    const dayStart = start + day * 86_400_000;
    // Weekends are ~35% busier; volume also trends up over the month.
    const date = new Date(dayStart);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const trend = 0.75 + (day / DAYS) * 0.5;
    const dayEvents = Math.floor(EVENTS_PER_DAY * trend * (weekend ? 1.35 : 1));

    for (let i = 0; i < dayEvents; i++) {
      // Concentrate activity in evening hours (UTC 16–23).
      const hour = Math.random() < 0.6 ? 16 + Math.floor(Math.random() * 8) : Math.floor(Math.random() * 24);
      const ts = new Date(dayStart + hour * 3_600_000 + Math.random() * 3_600_000);
      if (ts.getTime() > now) continue;

      const guild = guilds[Math.min(Math.floor(Math.random() ** 1.6 * guilds.length), guilds.length - 1)];
      const user = users[Math.floor(Math.random() ** 1.4 * users.length)];

      const roll = Math.random();
      if (roll < 0.97) {
        const cmd = pickCommand();
        const failed = Math.random() < cmd.errorRate;
        events.push({
          bot_id: bot.id,
          event_type: "command",
          event_name: cmd.name,
          guild_id: Math.random() < 0.03 ? "0" : guild.id,
          channel_type: Math.random() < 0.03 ? "dm" : "guild_text",
          user_hash: hashUser(user, salt),
          shard_id: 0,
          success: failed ? 0 : 1,
          duration_ms: Math.max(20, Math.round(cmd.avgMs * (0.5 + Math.random() * 1.5))),
          metadata: JSON.stringify({ source: "slash" }),
          created_at: chTs(ts),
        });
      } else {
        events.push({
          bot_id: bot.id,
          event_type: "custom",
          event_name: CUSTOM_EVENTS[Math.floor(Math.random() * CUSTOM_EVENTS.length)],
          guild_id: guild.id,
          channel_type: "guild_text",
          user_hash: hashUser(user, salt),
          shard_id: 0,
          success: 1,
          duration_ms: 0,
          metadata: JSON.stringify({ tier: Math.random() < 0.3 ? "gold" : "basic" }),
          created_at: chTs(ts),
        });
      }
    }

    // Joins/leaves: net growth of ~1/day with daily churn.
    const joins = 1 + Math.floor(Math.random() * 3);
    const leaves = Math.random() < 0.6 ? Math.floor(Math.random() * 2) : 0;
    for (let j = 0; j < joins; j++) {
      events.push({
        bot_id: bot.id,
        event_type: "guild_join",
        event_name: "",
        guild_id: snowflake(),
        channel_type: "other",
        user_hash: "",
        shard_id: 0,
        success: 1,
        duration_ms: 0,
        metadata: "",
        created_at: chTs(new Date(dayStart + Math.random() * 86_400_000)),
      });
    }
    for (let l = 0; l < leaves; l++) {
      events.push({
        bot_id: bot.id,
        event_type: "guild_leave",
        event_name: "",
        guild_id: guilds[Math.floor(Math.random() * guilds.length)].id,
        channel_type: "other",
        user_hash: "",
        shard_id: 0,
        success: 1,
        duration_ms: 0,
        metadata: "",
        created_at: chTs(new Date(dayStart + Math.random() * 86_400_000)),
      });
    }
    guildCount += joins - leaves;

    // Hourly snapshots.
    for (let hour = 0; hour < 24; hour++) {
      const ts = dayStart + hour * 3_600_000;
      if (ts > now) break;
      snapshots.push({
        bot_id: bot.id,
        shard_id: 0,
        total_shards: 1,
        guild_count: guildCount,
        approximate_member_sum: guildCount * 1400 + Math.floor(Math.random() * 5000),
        ws_ping_ms: 35 + Math.floor(Math.random() * 40),
        created_at: chTs(new Date(ts)),
      });
    }
  }

  for (let i = 0; i < events.length; i += 10_000) {
    await ch.insert({ table: "events", values: events.slice(i, i + 10_000), format: "JSONEachRow" });
  }
  await ch.insert({ table: "guild_snapshots", values: snapshots, format: "JSONEachRow" });

  console.log(`inserted ${events.length} events and ${snapshots.length} snapshots`);
  console.log(`dashboard: http://localhost:3000/bots/${bot.id}`);

  await ch.close();
  await pg.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
