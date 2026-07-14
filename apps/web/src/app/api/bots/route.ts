import { randomBytes } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api";
import { listAccessibleBots } from "@/lib/auth/access";
import { db } from "@/lib/db";
import { bots, botSettings, teamBots, users } from "@/lib/db/schema";
import { botQuotaFor, retentionCapFor } from "@/lib/deployment";
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

  const quota = botQuotaFor(auth.user.role);

  const bot = await db.transaction(async (tx) => {
    if (quota !== null) {
      // Lock the user row so concurrent creates serialize on the quota check.
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, auth.user.id))
        .for("update");
      const [owned] = await tx
        .select({ n: count() })
        .from(bots)
        .where(eq(bots.ownerUserId, auth.user.id));
      if (Number(owned?.n ?? 0) >= quota) return null;
    }

    const [created] = await tx
      .insert(bots)
      .values({
        name: parsed.data.name,
        discordApplicationId: parsed.data.discordApplicationId,
        ownerUserId: auth.user.id,
      })
      .returning();
    const retentionCap = retentionCapFor(auth.user.role);
    await tx.insert(botSettings).values({
      botId: created.id,
      userHashSalt: randomBytes(16).toString("hex"),
      // Capped accounts start at their ceiling instead of the 395 default.
      ...(retentionCap !== null ? { retentionDays: retentionCap } : {}),
    });
    if (teamId) {
      await tx.insert(teamBots).values({ teamId, botId: created.id });
    }
    return created;
  });

  if (!bot) {
    return jsonError(
      403,
      quota === 1
        ? "Your account is limited to 1 bot"
        : `Your account is limited to ${quota} bots`,
    );
  }

  return NextResponse.json({ bot }, { status: 201 });
}
