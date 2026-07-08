import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { usernameSchema } from "@/lib/admin";
import { jsonError, parseBody, requireTeamOwner } from "@/lib/api";
import { db } from "@/lib/db";
import { teamMembers, users } from "@/lib/db/schema";

type Params = { params: Promise<{ teamId: string }> };

const addSchema = z.object({ username: usernameSchema });

/** Adds a user (by username) to a team. Owner only. Idempotent. */
export async function POST(req: Request, { params }: Params) {
  const { teamId } = await params;
  const owner = await requireTeamOwner(teamId);
  if ("response" in owner) return owner.response;

  const parsed = await parseBody(req, addSchema);
  if ("response" in parsed) return parsed.response;

  const username = parsed.data.username.toLowerCase();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user) return jsonError(404, "No user with that username");

  await db
    .insert(teamMembers)
    .values({ teamId, userId: user.id })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true }, { status: 201 });
}
