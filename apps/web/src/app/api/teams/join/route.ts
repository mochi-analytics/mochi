import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { teamMembers, teams } from "@/lib/db/schema";

const joinSchema = z.object({
  accessCode: z.string().trim().min(1).max(64),
});

/** Joins a team by its access code. Idempotent for existing members. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const parsed = await parseBody(req, joinSchema);
  if ("response" in parsed) return parsed.response;

  const accessCode = parsed.data.accessCode.toUpperCase();
  const [team] = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.accessCode, accessCode))
    .limit(1);
  if (!team) return jsonError(404, "No team matches that access code");

  await db
    .insert(teamMembers)
    .values({ teamId: team.id, userId: auth.user.id })
    .onConflictDoNothing();

  return NextResponse.json({ team }, { status: 201 });
}
