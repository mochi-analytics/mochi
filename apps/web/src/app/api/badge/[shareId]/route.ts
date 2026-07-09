import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { renderBadge } from "@/lib/badge";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { formatCompact } from "@/lib/format";
import {
  getCommandTotals,
  getCurrentGuildCount,
  getUptime,
  parseRange,
} from "@/lib/queries";

export const runtime = "nodejs";

type Params = { params: Promise<{ shareId: string }> };

const METRICS = ["servers", "commands", "users", "uptime"] as const;
type Metric = (typeof METRICS)[number];

/**
 * Public stat badge, gated on the bot's share id — only bots whose owner
 * enabled public sharing are exposed. SVG by default; ?format=shields returns
 * a shields.io endpoint-badge JSON.
 */
export async function GET(req: Request, { params }: Params) {
  const { shareId } = await params;
  if (!z.string().uuid().safeParse(shareId).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [bot] = await db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.shareId, shareId))
    .limit(1);
  if (!bot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const metricParam = url.searchParams.get("metric") ?? "servers";
  const metric: Metric = (METRICS as readonly string[]).includes(metricParam)
    ? (metricParam as Metric)
    : "servers";
  const range = parseRange(url.searchParams.get("range") ?? undefined);

  let label: string;
  let value: string;
  switch (metric) {
    case "servers": {
      label = "servers";
      value = formatCompact(await getCurrentGuildCount(bot.id));
      break;
    }
    case "commands": {
      label = `commands (${range})`;
      value = formatCompact((await getCommandTotals(bot.id, range)).commands);
      break;
    }
    case "users": {
      label = `users (${range})`;
      value = formatCompact((await getCommandTotals(bot.id, range)).users);
      break;
    }
    case "uptime": {
      const uptime = await getUptime(bot.id, range);
      label = `uptime (${range})`;
      value = uptime === null ? "n/a" : `${uptime.toFixed(uptime >= 99.95 ? 1 : 2)}%`;
      break;
    }
  }

  const headers = { "Cache-Control": "public, max-age=300" };
  if (url.searchParams.get("format") === "shields") {
    return NextResponse.json(
      { schemaVersion: 1, label, message: value, color: "orange" },
      { headers },
    );
  }
  return new NextResponse(renderBadge(label, value), {
    headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" },
  });
}
