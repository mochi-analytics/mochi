import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireTeamOwner } from "@/lib/api";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";

type Params = { params: Promise<{ teamId: string }> };

const patchSchema = z.object({ name: z.string().trim().min(1).max(64) });

/** Renames a team. Owner only. */
export async function PATCH(req: Request, { params }: Params) {
  const { teamId } = await params;
  const owner = await requireTeamOwner(teamId);
  if ("response" in owner) return owner.response;

  const parsed = await parseBody(req, patchSchema);
  if ("response" in parsed) return parsed.response;
  const { name } = parsed.data;

  const [existing] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.name, name), ne(teams.id, teamId)))
    .limit(1);
  if (existing) return jsonError(409, "A team with that name already exists");

  const [updated] = await db
    .update(teams)
    .set({ name })
    .where(eq(teams.id, teamId))
    .returning({ id: teams.id, name: teams.name });

  return NextResponse.json({ team: updated });
}

/** Deletes a team. Owner only. Memberships cascade; users are not deleted. */
export async function DELETE(_req: Request, { params }: Params) {
  const { teamId } = await params;
  const owner = await requireTeamOwner(teamId);
  if ("response" in owner) return owner.response;

  await db.delete(teams).where(eq(teams.id, teamId));
  return NextResponse.json({ ok: true });
}
