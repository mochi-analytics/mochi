import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { teamMembers, teams, users } from "@/lib/db/schema";

type Params = { params: Promise<{ teamId: string }> };

const addSchema = z.object({ userId: z.string().uuid() });

/** Adds a user to a team. Idempotent — re-adding an existing member is a no-op. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { teamId } = await params;
  if (!z.string().uuid().safeParse(teamId).success) {
    return jsonError(404, "Team not found");
  }

  const parsed = await parseBody(req, addSchema);
  if ("response" in parsed) return parsed.response;
  const { userId } = parsed.data;

  const [[team], [user]] = await Promise.all([
    db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1),
    db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  if (!team) return jsonError(404, "Team not found");
  if (!user) return jsonError(404, "User not found");

  await db
    .insert(teamMembers)
    .values({ teamId, userId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true }, { status: 201 });
}
