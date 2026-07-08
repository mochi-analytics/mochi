import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api";
import { isWriter } from "@/lib/auth/access";
import { db } from "@/lib/db";
import { teamMembers, teams } from "@/lib/db/schema";
import { generateAccessCode, listTeamsForUser } from "@/lib/teams";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  return NextResponse.json({ teams: await listTeamsForUser(auth.user) });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(64) });

/** Creates a team owned by the current user, who becomes its first member. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!isWriter(auth.user)) {
    return jsonError(403, "Viewers cannot create teams");
  }

  const parsed = await parseBody(req, createSchema);
  if ("response" in parsed) return parsed.response;
  const { name } = parsed.data;

  const [existing] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.name, name))
    .limit(1);
  if (existing) return jsonError(409, "A team with that name already exists");

  // Retry once on the astronomically unlikely access-code collision.
  let created: { id: string; name: string } | undefined;
  for (let attempt = 0; attempt < 2 && !created; attempt++) {
    try {
      [created] = await db
        .insert(teams)
        .values({
          name,
          ownerUserId: auth.user.id,
          accessCode: generateAccessCode(),
        })
        .returning({ id: teams.id, name: teams.name });
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
  if (!created) return jsonError(500, "Failed to create team");

  await db
    .insert(teamMembers)
    .values({ teamId: created.id, userId: auth.user.id })
    .onConflictDoNothing();

  return NextResponse.json({ team: created }, { status: 201 });
}
