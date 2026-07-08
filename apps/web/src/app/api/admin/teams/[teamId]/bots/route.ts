import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { bots, teamBots, teams } from "@/lib/db/schema";

type Params = { params: Promise<{ teamId: string }> };

const addSchema = z.object({ botId: z.string().uuid() });

/** Shares a bot with a team. Idempotent — re-sharing is a no-op. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { teamId } = await params;
  if (!z.string().uuid().safeParse(teamId).success) {
    return jsonError(404, "Team not found");
  }

  const parsed = await parseBody(req, addSchema);
  if ("response" in parsed) return parsed.response;
  const { botId } = parsed.data;

  const [[team], [bot]] = await Promise.all([
    db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1),
    db.select({ id: bots.id }).from(bots).where(eq(bots.id, botId)).limit(1),
  ]);
  if (!team) return jsonError(404, "Team not found");
  if (!bot) return jsonError(404, "Bot not found");

  await db.insert(teamBots).values({ teamId, botId }).onConflictDoNothing();

  return NextResponse.json({ ok: true }, { status: 201 });
}
