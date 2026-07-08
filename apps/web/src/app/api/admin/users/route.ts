import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listUsersWithCounts,
  passwordSchema,
  roleSchema,
  usernameSchema,
} from "@/lib/admin";
import { jsonError, parseBody, requireAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  return NextResponse.json({ users: await listUsersWithCounts() });
}

const createSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: roleSchema,
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const parsed = await parseBody(req, createSchema);
  if ("response" in parsed) return parsed.response;
  const { username, password, role } = parsed.data;

  const normalized = username.toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, normalized))
    .limit(1);
  if (existing) return jsonError(409, "Username already taken");

  const [created] = await db
    .insert(users)
    .values({
      username: normalized,
      passwordHash: await hashPassword(password),
      role,
    })
    .returning({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    });

  return NextResponse.json({ user: created }, { status: 201 });
}
