import { describe, expect, it } from "vitest";
import {
  INGEST_MAX_BATCH_SIZE,
  ingestBatchSchema,
  ingestEventSchema,
  snapshotSchema,
} from "@/lib/ingest-contract";

describe("ingestEventSchema", () => {
  it("accepts a minimal command event", () => {
    const result = ingestEventSchema.safeParse({ type: "command", name: "ping" });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated event", () => {
    const result = ingestEventSchema.safeParse({
      type: "command",
      name: "play",
      guildId: "123456789012345678",
      userId: "876543210987654321",
      channelType: "guild_text",
      shardId: 3,
      success: true,
      durationMs: 250,
      meta: { source: "slash" },
      ts: "2026-07-08T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown event types", () => {
    expect(ingestEventSchema.safeParse({ type: "unknown" }).success).toBe(false);
  });

  it("rejects non-snowflake guild ids", () => {
    expect(
      ingestEventSchema.safeParse({ type: "guild_join", guildId: "not-a-snowflake" }).success,
    ).toBe(false);
    expect(
      ingestEventSchema.safeParse({ type: "guild_join", guildId: "1".repeat(21) }).success,
    ).toBe(false);
  });

  it("rejects negative or non-integer durations", () => {
    expect(
      ingestEventSchema.safeParse({ type: "command", name: "x", durationMs: -1 }).success,
    ).toBe(false);
    expect(
      ingestEventSchema.safeParse({ type: "command", name: "x", durationMs: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects out-of-range shard ids", () => {
    expect(ingestEventSchema.safeParse({ type: "command", name: "x", shardId: 65536 }).success).toBe(
      false,
    );
  });

  it("rejects timestamps without a valid ISO format", () => {
    expect(
      ingestEventSchema.safeParse({ type: "command", name: "x", ts: "yesterday" }).success,
    ).toBe(false);
  });

  it("accepts timestamps with an offset", () => {
    expect(
      ingestEventSchema.safeParse({ type: "command", name: "x", ts: "2026-07-08T12:00:00+02:00" })
        .success,
    ).toBe(true);
  });
});

describe("ingestBatchSchema", () => {
  it("rejects an empty batch", () => {
    expect(ingestBatchSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it("accepts a batch at the size limit", () => {
    const events = Array.from({ length: INGEST_MAX_BATCH_SIZE }, () => ({
      type: "guild_join",
    }));
    expect(ingestBatchSchema.safeParse({ events }).success).toBe(true);
  });

  it("rejects a batch over the size limit", () => {
    const events = Array.from({ length: INGEST_MAX_BATCH_SIZE + 1 }, () => ({
      type: "guild_join",
    }));
    expect(ingestBatchSchema.safeParse({ events }).success).toBe(false);
  });
});

describe("snapshotSchema", () => {
  it("accepts a minimal snapshot", () => {
    expect(snapshotSchema.safeParse({ guildCount: 42 }).success).toBe(true);
  });

  it("rejects a negative guild count", () => {
    expect(snapshotSchema.safeParse({ guildCount: -1 }).success).toBe(false);
  });

  it("rejects totalShards of zero", () => {
    expect(snapshotSchema.safeParse({ guildCount: 1, totalShards: 0 }).success).toBe(false);
  });

  it("accepts fractional cpuPercent and integer memoryMb", () => {
    expect(
      snapshotSchema.safeParse({ guildCount: 1, cpuPercent: 12.5, memoryMb: 256 })
        .success,
    ).toBe(true);
  });

  it("rejects a negative cpuPercent", () => {
    expect(
      snapshotSchema.safeParse({ guildCount: 1, cpuPercent: -1 }).success,
    ).toBe(false);
  });

  it("rejects a fractional memoryMb", () => {
    expect(
      snapshotSchema.safeParse({ guildCount: 1, memoryMb: 12.5 }).success,
    ).toBe(false);
  });
});
