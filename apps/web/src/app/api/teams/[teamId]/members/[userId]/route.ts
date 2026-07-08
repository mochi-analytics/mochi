import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { teamMembers, teams } from "@/lib/db/schema";

type Params = { params: Promise<{ teamId: string; userId: string }> };

/**
 * Removes a member from a team. Allowed when the requester owns the team
 * (removing anyone but the owner) or is removing themselves (leaving).
 * The owner cannot be removed — they must delete the team instead.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { teamId, userId } = await params;
  if (
    !z.string().uuid().safeParse(teamId).success ||
    !z.string().uuid().safeParse(userId).success
  ) {
    return jsonError(404, "Team not found");
  }

  const [team] = await db
    .select({ ownerUserId: teams.ownerUserId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return jsonError(404, "Team not found");

  const isOwner = team.ownerUserId === auth.user.id;
  const removingSelf = userId === auth.user.id;
  if (!isOwner && !removingSelf) {
    return jsonError(403, "You can only remove yourself from this team");
  }
  if (userId === team.ownerUserId) {
    return jsonError(400, "The owner must delete the team instead of leaving");
  }

  await db
    .delete(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    );

  return NextResponse.json({ ok: true });
}
