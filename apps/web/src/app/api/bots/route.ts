import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api";
import { listAccessibleBots } from "@/lib/auth/access";
import { db } from "@/lib/db";
import { bots, botSettings, teamBots } from "@/lib/db/schema";
import { getTeamForUser } from "@/lib/teams";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const rows = await listAccessibleBots(auth.user);
  return NextResponse.json({ bots: rows });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  discordApplicationId: z
    .string()
    .regex(/^\d{1,20}$/, "must be a Discord application id")
    .optional(),
  teamId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  // Viewers are read-only and cannot create bots.
  if (auth.user.role === "viewer") {
    return jsonError(403, "Read-only access");
  }

  const parsed = await parseBody(req, createSchema);
  if ("response" in parsed) return parsed.response;

  // You can only place a new bot in a team you own or belong to.
  const { teamId } = parsed.data;
  if (teamId && !(await getTeamForUser(teamId, auth.user))) {
    return jsonError(404, "Team not found");
  }

  const bot = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(bots)
      .values({
        name: parsed.data.name,
        discordApplicationId: parsed.data.discordApplicationId,
        ownerUserId: auth.user.id,
      })
      .returning();
    await tx.insert(botSettings).values({
      botId: created.id,
      userHashSalt: randomBytes(16).toString("hex"),
    });
    if (teamId) {
      await tx.insert(teamBots).values({ teamId, botId: created.id });
    }
    return created;
  });

  return NextResponse.json({ bot }, { status: 201 });
}
