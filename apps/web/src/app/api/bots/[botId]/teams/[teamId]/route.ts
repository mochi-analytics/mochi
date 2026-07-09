import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { teamBots } from "@/lib/db/schema";

type Params = { params: Promise<{ botId: string; teamId: string }> };

/**
 * Un-shares a bot from a team. Any writer on the bot may do this — even for
 * teams they don't belong to — since it only revokes access. The bot itself
 * is unaffected.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { botId, teamId } = await params;
  if (!z.string().uuid().safeParse(teamId).success) {
    return jsonError(404, "Share not found");
  }

  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  const deleted = await db
    .delete(teamBots)
    .where(
      and(eq(teamBots.teamId, teamId), eq(teamBots.botId, access.bot.id)),
    )
    .returning({ botId: teamBots.botId });
  if (deleted.length === 0) return jsonError(404, "Share not found");

  return NextResponse.json({ ok: true });
}
