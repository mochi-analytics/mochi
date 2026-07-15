import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api";
import { isWriter } from "@/lib/auth/access";
import { db } from "@/lib/db";
import { teamMembers, teams, users } from "@/lib/db/schema";
import { teamQuotaFor } from "@/lib/deployment";
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

  const quota = teamQuotaFor(auth.user.role);

  // Retry once on the astronomically unlikely access-code collision.
  let created: { id: string; name: string } | "quota" | undefined;
  for (let attempt = 0; attempt < 2 && !created; attempt++) {
    try {
      created = await db.transaction(async (tx) => {
        if (quota !== null) {
          // Lock the user row so concurrent creates serialize on the check.
          await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, auth.user.id))
            .for("update");
          const [owned] = await tx
            .select({ n: count() })
            .from(teams)
            .where(eq(teams.ownerUserId, auth.user.id));
          if (Number(owned?.n ?? 0) >= quota) return "quota" as const;
        }

        const [team] = await tx
          .insert(teams)
          .values({
            name,
            ownerUserId: auth.user.id,
            accessCode: generateAccessCode(),
          })
          .returning({ id: teams.id, name: teams.name });
        await tx
          .insert(teamMembers)
          .values({ teamId: team.id, userId: auth.user.id })
          .onConflictDoNothing();
        return team;
      });
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
  if (!created) return jsonError(500, "Failed to create team");
  if (created === "quota") {
    return jsonError(
      403,
      quota === 1
        ? "Your account is limited to 1 team"
        : `Your account is limited to ${quota} teams`,
    );
  }

  return NextResponse.json({ team: created }, { status: 201 });
}
