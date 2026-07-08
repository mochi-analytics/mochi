import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const bodySchema = z.object({
  username: z.string().min(1).max(32),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
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
