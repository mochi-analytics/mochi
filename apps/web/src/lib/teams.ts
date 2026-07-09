import { randomInt } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import type { Role } from "@/lib/admin";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { teamBots, teamMembers, teams, users } from "@/lib/db/schema";

/** Shared user-facing team domain: any user can create/own/join teams. */

// Unambiguous alphabet (no 0/O/1/I) for codes people read aloud and type.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** A short shareable code others enter to join a team. */
export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export type TeamMemberInfo = { id: string; username: string; role: Role };
export type UserTeam = {
  id: string;
  name: string;
  accessCode: string;
  isOwner: boolean;
  createdAt: Date;
  members: TeamMemberInfo[];
};

/** Team ids the user owns or is a member of. */
async function teamIdsForUser(user: SessionUser): Promise<string[]> {
  const rows = await db
    .selectDistinct({ teamId: teams.id })
    .from(teams)
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .where(
      or(eq(teams.ownerUserId, user.id), eq(teamMembers.userId, user.id)),
    );
  return rows.map((r) => r.teamId);
}

function membersByTeam(
  rows: { teamId: string; id: string; username: string; role: string }[],
) {
  const map = new Map<string, TeamMemberInfo[]>();
  for (const r of rows) {
    const list = map.get(r.teamId) ?? [];
    list.push({ id: r.id, username: r.username, role: r.role as Role });
    map.set(r.teamId, list);
  }
  return map;
}

/** All teams the user owns or belongs to, with members, newest first. */
export async function listTeamsForUser(user: SessionUser): Promise<UserTeam[]> {
  const ids = await teamIdsForUser(user);
  if (ids.length === 0) return [];

  const [teamRows, memberRows] = await Promise.all([
    db
      .select()
      .from(teams)
      .where(inArray(teams.id, ids))
      .orderBy(teams.createdAt),
    db
      .select({
        teamId: teamMembers.teamId,
        id: users.id,
        username: users.username,
        role: users.role,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(inArray(teamMembers.teamId, ids))
      .orderBy(users.username),
  ]);

  const members = membersByTeam(memberRows);
  return teamRows.map((t) => ({
    id: t.id,
    name: t.name,
    accessCode: t.accessCode,
    isOwner: t.ownerUserId === user.id,
    createdAt: t.createdAt,
    members: members.get(t.id) ?? [],
  }));
}

/** Teams a bot is currently shared with, alphabetical. */
export async function listTeamsForBot(
  botId: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: teams.id, name: teams.name })
    .from(teamBots)
    .innerJoin(teams, eq(teams.id, teamBots.teamId))
    .where(eq(teamBots.botId, botId))
    .orderBy(teams.name);
}

/** A single team the user can access (owner or member), else null. */
export async function getTeamForUser(
  teamId: string,
  user: SessionUser,
): Promise<UserTeam | null> {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return null;

  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      id: users.id,
      username: users.username,
      role: users.role,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(users.username);

  const isOwner = team.ownerUserId === user.id;
  const isMember = memberRows.some((m) => m.id === user.id);
  if (!isOwner && !isMember) return null;

  return {
    id: team.id,
    name: team.name,
    accessCode: team.accessCode,
    isOwner,
    createdAt: team.createdAt,
    members: memberRows.map((m) => ({
      id: m.id,
      username: m.username,
      role: m.role as Role,
    })),
  };
}
