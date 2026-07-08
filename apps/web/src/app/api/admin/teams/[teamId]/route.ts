import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";

type Params = { params: Promise<{ teamId: string }> };

/** Deletes a team. Memberships and bot shares cascade; users and bots remain. */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { teamId } = await params;
  if (!z.string().uuid().safeParse(teamId).success) {
    return jsonError(404, "Team not found");
  }

  const deleted = await db
    .delete(teams)
    .where(eq(teams.id, teamId))
    .returning({ id: teams.id });
  if (deleted.length === 0) return jsonError(404, "Team not found");

  return NextResponse.json({ ok: true });
}
