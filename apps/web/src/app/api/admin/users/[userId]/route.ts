import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isLastAdmin, passwordSchema, roleSchema } from "@/lib/admin";
import { jsonError, parseBody, requireAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

type Params = { params: Promise<{ userId: string }> };

const patchSchema = z
  .object({
    role: roleSchema.optional(),
    password: passwordSchema.optional(),
  })
  .refine((v) => v.role !== undefined || v.password !== undefined, {
    message: "Provide a role or a password to update",
  });

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success) {
    return jsonError(404, "User not found");
  }

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return jsonError(404, "User not found");

  const parsed = await parseBody(req, patchSchema);
  if ("response" in parsed) return parsed.response;
  const { role, password } = parsed.data;

  // Don't allow demoting the final admin — that would lock everyone out of /admin.
  if (role && role !== "admin" && (await isLastAdmin(userId))) {
    return jsonError(409, "Cannot change the role of the last admin");
  }

  const updates: Partial<typeof users.$inferInsert> = {};
  if (role) updates.role = role;
  if (password) updates.passwordHash = await hashPassword(password);

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    });

  // A password reset should invalidate the target's existing sessions.
  if (password) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  return NextResponse.json({ user: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success) {
    return jsonError(404, "User not found");
  }
  if (userId === auth.user.id) {
    return jsonError(409, "You cannot delete your own account");
  }
  if (await isLastAdmin(userId)) {
    return jsonError(409, "Cannot delete the last admin");
  }

  // Cascades remove the user's sessions, team memberships, and their bots
  // (and each bot's keys/settings/team shares) via FK ON DELETE CASCADE.
  const deleted = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (deleted.length === 0) return jsonError(404, "User not found");

  return NextResponse.json({ ok: true });
}
