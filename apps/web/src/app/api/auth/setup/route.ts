import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const bodySchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_.-]+$/i, "letters, numbers, _ . - only"),
  password: z.string().min(8).max(128),
});

/** First-run setup: creates the admin account. Only works while no users exist. */
export async function POST(req: Request) {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    return jsonError(403, "Setup has already been completed");
  }

  const parsed = await parseBody(req, bodySchema);
  if ("response" in parsed) return parsed.response;
  const { username, password } = parsed.data;

  const [user] = await db
    .insert(users)
    .values({
      username: username.toLowerCase(),
      passwordHash: await hashPassword(password),
      role: "admin",
    })
    .returning({ id: users.id, username: users.username });

  await createSession(user.id);
  return NextResponse.json({ user }, { status: 201 });
}
