-- Per-process resource usage, carried on the existing periodic health snapshot.
-- cpu_pct is normalized to 0-100 across all cores (percent of total machine
-- capacity); mem_rss_mb is resident set size in whole megabytes. Both default
-- to 0, which the read queries treat as "not reported" rather than genuine 0.
ALTER TABLE guild_snapshots
  ADD COLUMN IF NOT EXISTS cpu_pct     Float32 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mem_rss_mb  UInt32  DEFAULT 0;
