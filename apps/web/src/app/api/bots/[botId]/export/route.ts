import { NextResponse } from "next/server";
import { jsonError, requireBotAccess } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import {
  getCustomEventSummary,
  getRecentEvents,
  getTopCommands,
  getTopGuilds,
  parseRange,
} from "@/lib/queries";

type Params = { params: Promise<{ botId: string }> };

const iso = (t: number) => new Date(t).toISOString();

/**
 * Dashboard data export. `data` picks the dataset, `format` csv (default) or
 * json. Aggregates are unbounded in practice; `raw` is capped at 10k recent
 * events to keep responses sane.
 */
export async function GET(req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotAccess(botId);
  if ("response" in access) return access.response;

  const url = new URL(req.url);
  const data = url.searchParams.get("data") ?? "commands";
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const range = parseRange(url.searchParams.get("range") ?? undefined);
  const id = access.bot.id;

  let headers: string[];
  let rows: (string | number)[][];
  let items: Record<string, unknown>[];

  switch (data) {
    case "commands": {
      const commands = await getTopCommands(id, range, 1000);
      headers = ["command", "uses", "users", "success_rate_pct", "p50_ms", "p95_ms"];
      rows = commands.map((c) => [c.name, c.uses, c.users, c.successRate, c.p50, c.p95]);
      items = commands;
      break;
    }
    case "custom": {
      const events = await getCustomEventSummary(id, range);
      headers = ["event", "count", "users", "last_seen"];
      rows = events.map((e) => [e.name, e.count, e.users, iso(e.lastSeen)]);
      items = events.map((e) => ({ ...e, lastSeen: iso(e.lastSeen) }));
      break;
    }
    case "guilds": {
      const guilds = await getTopGuilds(id, range, 1000);
      headers = ["guild_id", "events", "users", "last_seen"];
      rows = guilds.map((g) => [g.guildId, g.events, g.users, iso(g.lastSeen)]);
      items = guilds.map((g) => ({ ...g, lastSeen: iso(g.lastSeen) }));
      break;
    }
    case "raw": {
      const events = await getRecentEvents(id, { limit: 10_000 });
      headers = [
        "at",
        "type",
        "name",
        "guild_id",
        "channel_type",
        "success",
        "duration_ms",
        "metadata",
      ];
      rows = events.map((e) => [
        iso(e.at),
        e.eventType,
        e.eventName,
        e.guildId,
        e.channelType,
        e.success,
        e.durationMs,
        e.metadata,
      ]);
      items = events.map((e) => ({ ...e, at: iso(e.at) }));
      break;
    }
    default:
      return jsonError(400, "data must be one of commands, custom, guilds, raw");
  }

  const filename = `mochi-${data}-${range}.${format}`;
  if (format === "json") {
    return NextResponse.json(
      { range, data: items },
      { headers: { "Content-Disposition": `attachment; filename="${filename}"` } },
    );
  }
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
