import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { listTeamsWithMembersAndBots } from "@/lib/admin";
import { jsonError, parseBody, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  return NextResponse.json({ teams: await listTeamsWithMembersAndBots() });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(64),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const parsed = await parseBody(req, createSchema);
  if ("response" in parsed) return parsed.response;
  const { name } = parsed.data;

  const [existing] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.name, name))
    .limit(1);
  if (existing) return jsonError(409, "A team with that name already exists");

  const [created] = await db
    .insert(teams)
    .values({ name })
    .returning({ id: teams.id, name: teams.name, createdAt: teams.createdAt });

  return NextResponse.json({ team: created }, { status: 201 });
}
