import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bots,
  teamBots,
  teamMembers,
  teams,
  users,
} from "@/lib/db/schema";

/** Shared admin-domain validation + queries used by the API and the /admin UI. */

export const ROLES = ["admin", "user", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9_.-]+$/i, "letters, numbers, _ . - only");

export const passwordSchema = z.string().min(8).max(128);
export const roleSchema = z.enum(ROLES);

/** Count of admin accounts — used to protect the last admin from lockout. */
export async function adminCount(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(eq(users.role, "admin"));
  return Number(row?.n ?? 0);
}

/** True if removing/demoting this user would leave zero admins. */
export async function isLastAdmin(userId: string): Promise<boolean> {
  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target || target.role !== "admin") return false;
  return (await adminCount()) <= 1;
}

export type AdminUser = {
  id: string;
  username: string;
  role: Role;
  createdAt: Date;
  botCount: number;
  teamCount: number;
};

/** All users with their owned-bot and team-membership counts, oldest first. */
export async function listUsersWithCounts(): Promise<AdminUser[]> {
  const rows = await db.select().from(users).orderBy(users.createdAt);

  const [botRows, teamRows] = await Promise.all([
    db
      .select({ ownerId: bots.ownerUserId, n: count() })
      .from(bots)
      .groupBy(bots.ownerUserId),
    db
      .select({ userId: teamMembers.userId, n: count() })
      .from(teamMembers)
      .groupBy(teamMembers.userId),
  ]);

  const botsByUser = new Map(botRows.map((r) => [r.ownerId, Number(r.n)]));
  const teamsByUser = new Map(teamRows.map((r) => [r.userId, Number(r.n)]));

  return rows.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role as Role,
    createdAt: u.createdAt,
    botCount: botsByUser.get(u.id) ?? 0,
    teamCount: teamsByUser.get(u.id) ?? 0,
  }));
}

export type TeamMemberInfo = { id: string; username: string; role: Role };
export type TeamBotInfo = { id: string; name: string };
export type AdminTeam = {
  id: string;
  name: string;
  createdAt: Date;
  members: TeamMemberInfo[];
  teamBots: TeamBotInfo[];
};

/** All teams with their members and shared bots, oldest first. */
export async function listTeamsWithMembersAndBots(): Promise<AdminTeam[]> {
  const teamRows = await db.select().from(teams).orderBy(teams.createdAt);

  const [memberRows, botRows] = await Promise.all([
    db
      .select({
        teamId: teamMembers.teamId,
        id: users.id,
        username: users.username,
        role: users.role,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .orderBy(users.username),
    db
      .select({
        teamId: teamBots.teamId,
        id: bots.id,
        name: bots.name,
      })
      .from(teamBots)
      .innerJoin(bots, eq(teamBots.botId, bots.id))
      .orderBy(bots.name),
  ]);

  return teamRows.map((t) => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
    members: memberRows
      .filter((m) => m.teamId === t.id)
      .map((m) => ({ id: m.id, username: m.username, role: m.role as Role })),
    teamBots: botRows
      .filter((b) => b.teamId === t.id)
      .map((b) => ({ id: b.id, name: b.name })),
  }));
}
