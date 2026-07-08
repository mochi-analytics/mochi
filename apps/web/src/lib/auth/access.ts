import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { bots, teamBots, teamMembers } from "@/lib/db/schema";

/**
 * Bot access model
 * ----------------
 * A user can *access* a bot if any of these hold:
 *   - they own it (`bots.owner_user_id`)
 *   - they are an admin (admins see everything)
 *   - they belong to a team the bot is shared with (`team_bots` ∩ `team_members`)
 *
 * A user can *write* to a bot (manage keys, settings, salt, sharing, deletion)
 * if they can access it AND their role is not `viewer`. Viewers are read-only
 * everywhere; admins and users get full management on any bot they can see.
 */

export type Bot = typeof bots.$inferSelect;

/** True if the role is allowed to mutate resources it can access. */
export function isWriter(user: Pick<SessionUser, "role">): boolean {
  return user.role !== "viewer";
}

/** Ids of the teams a user belongs to. Empty for admins is fine — they bypass. */
async function teamIdsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return rows.map((r) => r.teamId);
}

/**
 * Returns every bot the user can access, newest first, each tagged with whether
 * the user reaches it as `owner` or via a `team` (owner wins if both).
 */
export async function listAccessibleBots(
  user: SessionUser,
): Promise<(Bot & { access: "owner" | "team" })[]> {
  if (user.role === "admin") {
    const rows = await db.select().from(bots).orderBy(bots.createdAt);
    return rows.map((bot) => ({
      ...bot,
      access: bot.ownerUserId === user.id ? "owner" : "team",
    }));
  }

  const teamIds = await teamIdsForUser(user.id);

  // Distinct bots reachable as owner or through one of the user's teams.
  const rows = await db
    .selectDistinct({ bot: bots, ownerId: bots.ownerUserId })
    .from(bots)
    .leftJoin(teamBots, eq(teamBots.botId, bots.id))
    .where(
      teamIds.length > 0
        ? or(eq(bots.ownerUserId, user.id), inArray(teamBots.teamId, teamIds))
        : eq(bots.ownerUserId, user.id),
    )
    .orderBy(bots.createdAt);

  return rows.map(({ bot }) => ({
    ...bot,
    access: bot.ownerUserId === user.id ? "owner" : "team",
  }));
}

/**
 * Returns the bot if the user can access it, with a `canWrite` flag, else null.
 * `canWrite` folds together role (viewers never write) and reachability.
 */
export async function getAccessibleBot(
  botId: string,
  user: SessionUser,
): Promise<(Bot & { canWrite: boolean }) | null> {
  if (!z.string().uuid().safeParse(botId).success) return null;

  if (user.role === "admin") {
    const [bot] = await db
      .select()
      .from(bots)
      .where(eq(bots.id, botId))
      .limit(1);
    return bot ? { ...bot, canWrite: true } : null;
  }

  const teamIds = await teamIdsForUser(user.id);

  const [row] = await db
    .selectDistinct({ bot: bots })
    .from(bots)
    .leftJoin(teamBots, eq(teamBots.botId, bots.id))
    .where(
      and(
        eq(bots.id, botId),
        teamIds.length > 0
          ? or(eq(bots.ownerUserId, user.id), inArray(teamBots.teamId, teamIds))
          : eq(bots.ownerUserId, user.id),
      ),
    )
    .limit(1);

  if (!row) return null;
  return { ...row.bot, canWrite: isWriter(user) };
}

/** Whether a specific bot is shared with a specific team. */
export async function isBotInTeam(
  botId: string,
  teamId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ botId: teamBots.botId })
    .from(teamBots)
    .where(and(eq(teamBots.botId, botId), eq(teamBots.teamId, teamId)))
    .limit(1);
  return Boolean(row);
}
