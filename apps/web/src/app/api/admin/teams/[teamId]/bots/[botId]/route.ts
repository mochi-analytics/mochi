import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { teamBots } from "@/lib/db/schema";

type Params = { params: Promise<{ teamId: string; botId: string }> };

/** Un-shares a bot from a team. The bot itself is unaffected. */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { teamId, botId } = await params;
  if (
    !z.string().uuid().safeParse(teamId).success ||
    !z.string().uuid().safeParse(botId).success
  ) {
    return jsonError(404, "Share not found");
  }

  const deleted = await db
    .delete(teamBots)
    .where(and(eq(teamBots.teamId, teamId), eq(teamBots.botId, botId)))
    .returning({ botId: teamBots.botId });
  if (deleted.length === 0) return jsonError(404, "Share not found");

  return NextResponse.json({ ok: true });
}
