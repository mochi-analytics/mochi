import { z } from "zod";

export const INGEST_MAX_BATCH_SIZE = 100;
export const INGEST_MAX_EVENT_AGE_MS = 48 * 60 * 60 * 1000;
export const INGEST_MAX_META_BYTES = 2048;

export const eventTypes = [
  "command",
  "guild_join",
  "guild_leave",
  "error",
  "custom",
] as const;

export type EventType = (typeof eventTypes)[number];

export const channelTypes = [
  "guild_text",
  "guild_voice",
  "thread",
  "dm",
  "group_dm",
  "other",
] as const;

const snowflake = z.string().regex(/^\d{1,20}$/, "must be a Discord snowflake");

export const ingestEventSchema = z.object({
  type: z.enum(eventTypes),
  /** Command name or custom event name. Required for command/custom/error. */
  name: z.string().min(1).max(128).optional(),
  guildId: snowflake.optional(),
  /** Raw Discord user id - hashed server-side with the bot's salt, never stored. */
  userId: snowflake.optional(),
  channelType: z.enum(channelTypes).optional(),
  shardId: z.number().int().min(0).max(65535).optional(),
  success: z.boolean().optional(),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  /** Event time; defaults to arrival time. Rejected if older than 48h. */
  ts: z.string().datetime({ offset: true }).optional(),
});

export const ingestBatchSchema = z.object({
  events: z.array(ingestEventSchema).min(1).max(INGEST_MAX_BATCH_SIZE),
});

export const snapshotSchema = z.object({
  guildCount: z.number().int().min(0),
  shardId: z.number().int().min(0).max(65535).optional(),
  totalShards: z.number().int().min(1).max(65536).optional(),
  approximateMemberSum: z.number().int().min(0).optional(),
  wsPingMs: z.number().int().min(0).optional(),
  /** Process CPU usage, normalized to 0-100 across all cores. */
  cpuPercent: z.number().min(0).max(100_000).optional(),
  /** Process resident set size in whole megabytes. */
  memoryMb: z.number().int().min(0).max(4_194_304).optional(),
  ts: z.string().datetime({ offset: true }).optional(),
});

export type IngestEvent = z.infer<typeof ingestEventSchema>;
export type IngestBatch = z.infer<typeof ingestBatchSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
