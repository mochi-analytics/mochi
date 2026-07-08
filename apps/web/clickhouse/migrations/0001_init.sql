CREATE TABLE IF NOT EXISTS events (
  bot_id        UUID,
  event_type    LowCardinality(String),
  event_name    String,
  guild_id      UInt64 DEFAULT 0,
  channel_type  LowCardinality(String) DEFAULT 'other',
  user_hash     FixedString(16) DEFAULT toFixedString('', 16),
  shard_id      UInt16 DEFAULT 0,
  success       UInt8 DEFAULT 1,
  duration_ms   UInt32 DEFAULT 0,
  metadata      String DEFAULT '',
  created_at    DateTime64(3) DEFAULT now64(3)
) ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (bot_id, event_type, created_at);

CREATE TABLE IF NOT EXISTS guild_snapshots (
  bot_id                  UUID,
  shard_id                UInt16 DEFAULT 0,
  total_shards            UInt16 DEFAULT 1,
  guild_count             UInt32,
  approximate_member_sum  UInt64 DEFAULT 0,
  ws_ping_ms              UInt32 DEFAULT 0,
  created_at              DateTime64(3) DEFAULT now64(3)
) ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (bot_id, created_at);
