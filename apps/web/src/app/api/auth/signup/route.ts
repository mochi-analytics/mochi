import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { passwordSchema, usernameSchema } from "@/lib/admin";
import { jsonError, parseBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isCloud } from "@/lib/deployment";
import { rateLimitResponse } from "@/lib/rate-limit";

const bodySchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

// 5 signup attempts per hour per IP.
const SIGNUP_RULE = { limit: 5, windowMs: 60 * 60 * 1000 };

/**
 * Open self-service registration. Cloud mode only — self-hosted instances
 * keep account creation in the admin panel. Always creates a `user`; the
 * operator's admin account comes from first-run /setup.
 */
export async function POST(req: Request) {
  if (!isCloud()) {
    return jsonError(404, "Signups are disabled on this instance");
  }

  const limited = rateLimitResponse(req, "signup", SIGNUP_RULE);
  if (limited) return limited;

  // /setup must run first so the instance has an admin before open signup.
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length === 0) {
    return jsonError(403, "Instance setup has not been completed");
  }

  const parsed = await parseBody(req, bodySchema);
  if ("response" in parsed) return parsed.response;
  const { username, password } = parsed.data;

  const normalized = username.toLowerCase();
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, normalized))
    .limit(1);
  if (taken) return jsonError(409, "Username already taken");

  const [user] = await db
    .insert(users)
    .values({
      username: normalized,
      passwordHash: await hashPassword(password),
      role: "user",
    })
    .returning({ id: users.id, username: users.username });

  await createSession(user.id);
  return NextResponse.json({ user }, { status: 201 });
}
