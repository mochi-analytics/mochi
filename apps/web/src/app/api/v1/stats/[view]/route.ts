import { NextResponse } from "next/server";
import { authenticateIngest, jsonError } from "@/lib/ingest";
import {
  getCommandVolumeSeries,
  getErrorSeries,
  getOverviewStats,
  getTopCommands,
  getTopErrors,
  getUptime,
  parseRange,
} from "@/lib/queries";

export const runtime = "nodejs";

type Params = { params: Promise<{ view: string }> };

/**
 * Read-only stats API, authenticated with the same per-bot API key as
 * ingest (and sharing its rate limit). Lets bot developers pull their own
 * numbers into status commands, bot-list pages, or external dashboards.
 *
 *   GET /api/v1/stats/overview?range=30d
 *   GET /api/v1/stats/commands?range=30d&limit=50
 *   GET /api/v1/stats/errors?range=30d&limit=50
 *   GET /api/v1/stats/series?metric=commands|errors&range=30d
 */
export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateIngest(req);
  if ("response" in auth) return auth.response;

  const { view } = await params;
  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("range") ?? undefined);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 50, 1),
    100,
  );
  const botId = auth.ctx.botId;

  switch (view) {
    case "overview": {
      const [stats, uptime] = await Promise.all([
        getOverviewStats(botId, range),
        getUptime(botId, range),
      ]);
      return NextResponse.json({ range, ...stats, uptimePct: uptime });
    }
    case "commands": {
      return NextResponse.json({
        range,
        commands: await getTopCommands(botId, range, limit),
      });
    }
    case "errors": {
      const errors = await getTopErrors(botId, range, limit);
      return NextResponse.json({
        range,
        errors: errors.map((e) => ({
          ...e,
          firstSeen: new Date(e.firstSeen).toISOString(),
          lastSeen: new Date(e.lastSeen).toISOString(),
        })),
      });
    }
    case "series": {
      const metric = url.searchParams.get("metric") ?? "commands";
      if (metric !== "commands" && metric !== "errors") {
        return jsonError(400, "metric must be commands or errors");
      }
      const series =
        metric === "commands"
          ? await getCommandVolumeSeries(botId, range)
          : await getErrorSeries(botId, range);
      return NextResponse.json({ range, metric, series });
    }
    default:
      return jsonError(
        404,
        "Unknown view — use overview, commands, errors, or series",
      );
  }
}
