import { NextResponse } from "next/server";
import { clickhouse } from "@/lib/clickhouse";
import {
  INGEST_MAX_EVENT_AGE_MS,
  INGEST_MAX_META_BYTES,
  ingestBatchSchema,
  type IngestEvent,
} from "@/lib/ingest-contract";
import { authenticateIngest, hashUserId, jsonError } from "@/lib/ingest";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;

type EventRow = {
  bot_id: string;
  event_type: string;
  event_name: string;
  guild_id: string;
  channel_type: string;
  user_hash: string;
  shard_id: number;
  success: number;
  duration_ms: number;
  metadata: string;
  created_at: string;
};

function toChTimestamp(date: Date): string {
  // ClickHouse DateTime64 wants "YYYY-MM-DD HH:MM:SS.mmm" in UTC.
  return date.toISOString().replace("T", " ").replace("Z", "");
}

function toRow(
  event: IngestEvent,
  botId: string,
  salt: string,
  now: number,
): EventRow | { rejected: string } {
  const ts = event.ts ? new Date(event.ts).getTime() : now;
  if (now - ts > INGEST_MAX_EVENT_AGE_MS) {
    return { rejected: "event older than 48h" };
  }
  if (ts - now > 5 * 60_000) {
    return { rejected: "event timestamp is in the future" };
  }
  if (
    (event.type === "command" || event.type === "custom" || event.type === "error") &&
    !event.name
  ) {
    return { rejected: `"name" is required for ${event.type} events` };
  }
  const metadata = event.meta ? JSON.stringify(event.meta) : "";
  if (Buffer.byteLength(metadata) > INGEST_MAX_META_BYTES) {
    return { rejected: "meta exceeds 2KB" };
  }
  return {
    bot_id: botId,
    event_type: event.type,
    event_name: event.name ?? "",
    guild_id: event.guildId ?? "0",
    channel_type: event.channelType ?? "other",
    user_hash: event.userId ? hashUserId(event.userId, salt) : "",
    shard_id: event.shardId ?? 0,
    success: event.success === false ? 0 : 1,
    duration_ms: event.durationMs ?? 0,
    metadata,
    created_at: toChTimestamp(new Date(ts)),
  };
}

export async function POST(req: Request) {
  const auth = await authenticateIngest(req);
  if ("response" in auth) return auth.response;

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError(413, "Body exceeds 256KB");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const parsed = ingestBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const now = Date.now();
  const rows: EventRow[] = [];
  const rejections: { index: number; reason: string }[] = [];
  parsed.data.events.forEach((event, index) => {
    const row = toRow(event, auth.ctx.botId, auth.ctx.userHashSalt, now);
    if ("rejected" in row) {
      rejections.push({ index, reason: row.rejected });
    } else {
      rows.push(row);
    }
  });

  if (rows.length > 0) {
    await clickhouse.insert({
      table: "events",
      values: rows,
      format: "JSONEachRow",
    });
  }

  return NextResponse.json(
    { accepted: rows.length, rejected: rejections.length, rejections },
    { status: 202 },
  );
}
