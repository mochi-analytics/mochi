# Mochi — Analytics for Discord Bots

*Umami, but for Discord bots: self-hosted, privacy-friendly, one dashboard for command usage, guild growth, and bot health.*

Decisions locked in (2026-07-07):
- **Model:** self-hosted OSS first; hosted cloud possible later.
- **Ingestion:** documented HTTP API + official SDKs (discord.js first).
- **Stack:** single Next.js + TypeScript app (dashboard + API).
- **Storage:** Postgres (relational/config) + ClickHouse (events). ClickHouse is the *only* event store — no dual Postgres/ClickHouse query paths (that duality is one of Umami's biggest maintenance burdens).

## 1. Product scope (v1)

**Who it's for:** bot developers who want to know how their bot is actually used without wiring up Grafana or paying for a hosted service.

**What v1 answers:**
- How many guilds am I in, and what's the join/leave trend? (growth + churn)
- Which commands get used, how often, by how many unique users, and where (guild vs DM)?
- Are commands failing? How slow are they?
- Which guilds are most/least active?
- Custom events the developer defines (e.g. `premium_purchased`).

**Explicitly out of v1:** message-content anything (Discord policy landmine), per-user profiles (user IDs are hashed, Umami-style), alerting, multi-instance clustering, billing.

## 2. Architecture

```
┌─────────────┐   HTTPS batch   ┌──────────────────────────┐
│ Discord bot  │ ──────────────► │  Next.js app (Mochi)     │
│ + Mochi SDK  │                 │  /api/v1/ingest          │──► ClickHouse (events)
└─────────────┘                 │  dashboard + mgmt API     │──► Postgres  (users, bots, keys)
                                └──────────────────────────┘
```

- **One deployable**: a single Next.js (App Router, TS) container serves the dashboard, management API, and ingest endpoint. No separate ingest service in v1 — a route handler writing to ClickHouse with async inserts handles thousands of events/sec.
- **Postgres** (Drizzle): users, bots, API keys, per-bot settings.
- **ClickHouse** (`@clickhouse/client`): all events + snapshots + materialized-view rollups.
- **No Redis in v1.** In-memory token-bucket rate limiting per API key (fine single-instance); SDKs batch client-side.

## 3. Data model

### Postgres
- `user` — id, username, password_hash, role (`admin`/`member`), created_at. First-run setup wizard creates the admin.
- `bot` — id (uuid), name, discord_application_id, owner_user_id, created_at. (Analog of Umami's "website".)
- `api_key` — id, bot_id, key_hash (SHA-256; plaintext shown once), name, last_used_at, revoked_at.
- `bot_settings` — retention_days, user_hash_salt (per-bot, rotatable), timezone.

### ClickHouse

**`events`**:

```sql
CREATE TABLE events (
  bot_id        UUID,
  event_type    LowCardinality(String),  -- 'command' | 'guild_join' | 'guild_leave' | 'error' | 'custom'
  event_name    String,                  -- command name / custom event name
  guild_id      UInt64,                  -- 0 = DM
  channel_type  LowCardinality(String),
  user_hash     FixedString(16),         -- salted truncated hash of the Discord user id
  shard_id      UInt16,
  success       UInt8,
  duration_ms   UInt32,
  metadata      String,                  -- JSON string, ≤2 KB
  created_at    DateTime64(3)
) ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (bot_id, event_type, created_at)
TTL toDateTime(created_at) + INTERVAL 13 MONTH;
```

**`guild_snapshots`** — sent by SDK on `ready` and hourly: bot_id, guild_count, shard_count, approximate_member_sum, ws_ping_ms, created_at. Powers accurate "total guilds over time" even if the bot was offline (joins/leaves alone drift when events are missed).

**Materialized views** (Summing/AggregatingMergeTree): hourly command counts per (bot, event_name); daily unique users (`uniqState(user_hash)`); daily joins/leaves. Long-range dashboard queries hit these; short ranges hit raw `events`.

**Privacy stance:** user IDs hashed with a per-bot salt before storage — uniques and retention are countable but individuals aren't identifiable; rotating the salt anonymizes history. Never store message content, usernames, or guild names by default (guild names opt-in via SDK flag, stored in metadata, for readable "top guilds" tables).

## 4. Ingest API

```
POST /api/v1/ingest
Authorization: Bearer mochi_sk_...

{ "events": [
  { "type": "command", "name": "play", "guildId": "935...", "userId": "102...",
    "channelType": "guild_text", "success": true, "durationMs": 143,
    "shardId": 0, "ts": "2026-07-07T12:00:00.000Z", "meta": { "source": "slash" } }
] }
```

- Max 100 events/request, 256 KB body; events older than 48h rejected (protects rollups from backfill skew; backfill mode later).
- Server hashes `userId` with the bot's salt — SDKs stay crypto-free; salt rotation stays server-side.
- Responses: `202` with per-event accept/reject counts; `429` + `Retry-After` when rate-limited.
- Versioned path (`/v1/`) from day one.

## 5. SDKs

- **`mochi-js` repo:** owns `@mochi-analytics/core` (plain Node client) and `@mochi-analytics/discordjs` (discord.js adapter). Future JavaScript Discord adapters should be added to that SDK monorepo.
- **Raw HTTP is first-class** — the endpoint spec is the documented contract so any language can integrate. `mochi.py` is a fast follow, not v1.

## 6. Dashboard (v1 pages)

- **Bots list** → per-bot **Overview**: stat tiles (servers now, net joins/leaves, commands run, unique users, error rate, p95 latency) + time series for guild count (snapshots), joins vs leaves, command volume.
- **Commands**: table (count, unique users, success rate, p50/p95 latency) → per-command trend.
- **Guilds**: top guilds by activity, recently joined/left, "inactive ≥30 days" churn-risk list.
- **Events**: filterable custom-event explorer, breakdown by `meta` keys.
- **Realtime**: last-30-minutes live feed and counters.
- **Settings**: API keys, retention, salt rotation, delete bot.
- Global: date-range picker (24h/7d/30d/90d/custom), timezone-aware bucketing, **shareable read-only dashboard link** (public stats page — Umami's killer feature).

UI: Tailwind + shadcn/ui, Recharts, TanStack Query against plain REST route handlers (no tRPC — keeps the mgmt API usable by third parties later).

## 7. Repo layout & tooling

```
mochi/
├─ apps/web/                 # Next.js dashboard + API
├─ docker/                   # Dockerfile, docker-compose.yml (app + postgres + clickhouse)
└─ docs/                     # ingest API spec, self-hosting guide, SDK guides
```

pnpm workspaces + Turborepo; Drizzle migrations (PG); small ordered-SQL-file runner for ClickHouse migrations; GitHub Actions CI + Docker image to GHCR. JavaScript SDK packages live in the separate `mochi-js` repo.

## 8. Milestones

1. ~~**Skeleton:**~~ Done — monorepo, docker-compose (3 services), PG schema + credentials auth + sessions, first-run setup, create-bot + API-key flows.
2. ~~**Ingest path:**~~ Done — `/api/v1/ingest` + `/api/v1/snapshot` (zod validation, key auth, rate limiting), ClickHouse writes + migrations, seed script.
3. ~~**SDKs:**~~ Done — core client + discord.js adapter moved to the separate `mochi-js` repo (verified against live ingest; real-guild testing still worthwhile before publishing).
4. ~~**Dashboard:**~~ Done — overview, commands, guilds, events, realtime, settings; events_daily MV rollup accumulating (dashboards read raw events for now).
5. ~~**Release polish:**~~ Done — docs, self-host Dockerfile + compose with startup migrations, share links, retention cleanup job, CI workflow. Remaining for `v0.1` release: publish JS SDK packages from `mochi-js` + GHCR image (requires accounts/secrets).

**Post-v1 backlog:** discord.py SDK, retention/cohort charts, webhooks/alerts ("left 10 guilds in an hour"), teams/multi-user, public stats pages, hosted cloud (per-bot keys/salts already lay the multi-tenant groundwork).

## 9. Risks & open questions

- **ClickHouse for small self-hosters** — idles ~0.5–1 GB RAM. Mitigate with a tuned low-memory config in compose + docs. Fallback if it kills adoption: Postgres-only mode — but that means dual query paths, so don't build it preemptively.
- **Duration/success capture in discord.js** is fuzzy (SDK can't see inside user handlers) — `wrapHandler` for accuracy, best-effort otherwise. Prototype early.
- **Guild-count accuracy for sharded/clustered bots** — snapshots must be summed server-side by (bot, time bucket); payload includes `shardId`/`totalShards`. Fiddliest part of the data model.
- ~~**Naming/npm scope**~~ — `@mochi-analytics` npm org secured (2026-07-07). Matching GitHub org still worth grabbing if not done.
