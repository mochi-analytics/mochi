import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";

type Params = { params: Promise<{ teamId: string; userId: string }> };

/** Removes a user from a team. Their owned bots are unaffected. */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { teamId, userId } = await params;
  if (
    !z.string().uuid().safeParse(teamId).success ||
    !z.string().uuid().safeParse(userId).success
  ) {
    return jsonError(404, "Membership not found");
  }

  const deleted = await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .returning({ userId: teamMembers.userId });
  if (deleted.length === 0) return jsonError(404, "Membership not found");

  return NextResponse.json({ ok: true });
}
