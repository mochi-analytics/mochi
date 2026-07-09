import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { teamBots } from "@/lib/db/schema";
import { getTeamForUser } from "@/lib/teams";

type Params = { params: Promise<{ botId: string }> };

const shareSchema = z.object({ teamId: z.string().uuid() });

/**
 * Shares a bot with one of the caller's teams. Requires write access to the
 * bot and membership (owner or member) of the target team. Idempotent.
 */
export async function POST(req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  const parsed = await parseBody(req, shareSchema);
  if ("response" in parsed) return parsed.response;

  const team = await getTeamForUser(parsed.data.teamId, access.user);
  if (!team) return jsonError(404, "Team not found");

  await db
    .insert(teamBots)
    .values({ teamId: team.id, botId: access.bot.id })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true }, { status: 201 });
}
