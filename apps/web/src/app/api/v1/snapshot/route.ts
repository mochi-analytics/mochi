import { NextResponse } from "next/server";
import { clickhouse } from "@/lib/clickhouse";
import { snapshotSchema } from "@/lib/ingest-contract";
import { authenticateIngest, jsonError } from "@/lib/ingest";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticateIngest(req);
  if ("response" in auth) return auth.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const snapshot = parsed.data;

  await clickhouse.insert({
    table: "guild_snapshots",
    values: [
      {
        bot_id: auth.ctx.botId,
        shard_id: snapshot.shardId ?? 0,
        total_shards: snapshot.totalShards ?? 1,
        guild_count: snapshot.guildCount,
        approximate_member_sum: snapshot.approximateMemberSum ?? 0,
        ws_ping_ms: snapshot.wsPingMs ?? 0,
        created_at: (snapshot.ts ? new Date(snapshot.ts) : new Date())
          .toISOString()
          .replace("T", " ")
          .replace("Z", ""),
      },
    ],
    format: "JSONEachRow",
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
