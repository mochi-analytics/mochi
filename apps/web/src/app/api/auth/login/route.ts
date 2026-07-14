import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isCloud } from "@/lib/deployment";
import { rateLimitResponse } from "@/lib/rate-limit";

const bodySchema = z.object({
  username: z.string().min(1).max(32),
  password: z.string().min(1).max(128),
});

// 10 attempts per 15 minutes per IP, cloud only.
const LOGIN_RULE = { limit: 10, windowMs: 15 * 60 * 1000 };

export async function POST(req: Request) {
  if (isCloud()) {
    const limited = await rateLimitResponse(req, "login", LOGIN_RULE);
    if (limited) return limited;
  }

  const parsed = await parseBody(req, bodySchema);
  if ("response" in parsed) return parsed.response;
  const { username, password } = parsed.data;

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  const user = rows[0];

  // Run the comparison even for unknown users to keep timing uniform.
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalw",
  );
  if (!user || !valid) {
    return jsonError(401, "Invalid username or password");
  }

  await createSession(user.id);
  return NextResponse.json({
    user: { id: user.id, username: user.username },
  });
}
