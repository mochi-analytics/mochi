import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user", "viewer"] })
    .notNull()
    .default("user"),
  // IANA timezone used to render this user's dashboards
  timezone: text("timezone").notNull().default("UTC"),
  // preset date range applied when a page has no explicit ?range=
  defaultRange: text("default_range", {
    enum: ["24h", "7d", "30d", "90d"],
  })
    .notNull()
    .default("30d"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  // sha256 hex of the session token; the raw token only lives in the cookie
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bots = pgTable("bots", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  discordApplicationId: text("discord_application_id"),
  // non-null = public read-only dashboard at /share/<shareId>
  shareId: uuid("share_id").unique(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const botSettings = pgTable("bot_settings", {
  botId: uuid("bot_id")
    .primaryKey()
    .references(() => bots.id, { onDelete: "cascade" }),
  retentionDays: integer("retention_days").notNull().default(395),
  // per-bot salt for hashing Discord user ids; rotating it anonymizes history
  userHashSalt: text("user_hash_salt").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  // the user who created the team; only they can manage/delete it
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // shareable code others enter to join the team
  accessCode: text("access_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

// A bot in a team is viewable (read-only) by every member of that team.
export const teamBots = pgTable(
  "team_bots",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.botId] })],
);

// Per-bot Discord-webhook alerting. One config per bot; individual rules are
// toggled and tuned here. Alert *state* (dedupe, cooldowns) lives in
// alert_states so config edits never reset in-flight alerts.
export const alertConfigs = pgTable("alert_configs", {
  botId: uuid("bot_id")
    .primaryKey()
    .references(() => bots.id, { onDelete: "cascade" }),
  webhookUrl: text("webhook_url").notNull(),
  // no snapshots for N minutes → "bot offline" (recovery message when back).
  // Default covers the SDKs' hourly snapshot cadence with one missed beat.
  offlineEnabled: boolean("offline_enabled").notNull().default(true),
  offlineAfterMinutes: integer("offline_after_minutes").notNull().default(120),
  // command failure rate over the last 15 minutes ≥ N% → "error spike"
  errorSpikeEnabled: boolean("error_spike_enabled").notNull().default(true),
  errorRatePct: integer("error_rate_pct").notNull().default(10),
  // guild count down ≥ N% versus 24 hours ago → "server drop"
  guildDropEnabled: boolean("guild_drop_enabled").notNull().default(true),
  guildDropPct: integer("guild_drop_pct").notNull().default(5),
  // Monday 00:00 UTC summary of the previous week
  digestEnabled: boolean("digest_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const alertStates = pgTable(
  "alert_states",
  {
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["offline", "error_spike", "guild_drop", "digest"],
    }).notNull(),
    // for offline: currently in the alerted state (suppresses refires,
    // triggers the recovery message)
    active: boolean("active").notNull().default(false),
    lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.botId, t.kind] })],
);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // sha256 hex of the full key; plaintext is shown once at creation
  keyHash: text("key_hash").notNull().unique(),
  // first characters of the key, for display ("mochi_sk_ab12…")
  keyPrefix: text("key_prefix").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
