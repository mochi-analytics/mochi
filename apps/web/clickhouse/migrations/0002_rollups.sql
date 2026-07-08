CREATE TABLE IF NOT EXISTS events_daily (
  bot_id           UUID,
  date             Date,
  event_type       LowCardinality(String),
  event_name       String,
  events           SimpleAggregateFunction(sum, UInt64),
  failures         SimpleAggregateFunction(sum, UInt64),
  duration_ms_sum  SimpleAggregateFunction(sum, UInt64),
  users            AggregateFunction(uniq, FixedString(16))
) ENGINE = AggregatingMergeTree
ORDER BY (bot_id, date, event_type, event_name);

CREATE MATERIALIZED VIEW IF NOT EXISTS events_daily_mv TO events_daily AS
SELECT
  bot_id,
  toDate(created_at) AS date,
  event_type,
  event_name,
  count() AS events,
  countIf(success = 0) AS failures,
  sum(duration_ms) AS duration_ms_sum,
  uniqStateIf(user_hash, user_hash != toFixedString('', 16)) AS users
FROM events
GROUP BY bot_id, date, event_type, event_name;

INSERT INTO events_daily
SELECT
  bot_id,
  toDate(created_at) AS date,
  event_type,
  event_name,
  count() AS events,
  countIf(success = 0) AS failures,
  sum(duration_ms) AS duration_ms_sum,
  uniqStateIf(user_hash, user_hash != toFixedString('', 16)) AS users
FROM events
GROUP BY bot_id, date, event_type, event_name;
