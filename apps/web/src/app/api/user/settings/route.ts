import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { passwordSchema, usernameSchema } from "@/lib/admin";
import { jsonError, parseBody, requireUser } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      // throws RangeError for an unknown IANA timezone
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Unknown timezone" },
);

const rangeSchema = z.enum(["24h", "7d", "30d", "90d"]);

const patchSchema = z
  .object({
    username: usernameSchema.optional(),
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: passwordSchema.optional(),
    timezone: timezoneSchema.optional(),
    defaultRange: rangeSchema.optional(),
  })
  .refine(
    (v) =>
      v.username !== undefined ||
      v.newPassword !== undefined ||
      v.timezone !== undefined ||
      v.defaultRange !== undefined,
    { message: "Provide a setting to update" },
  )
  .refine((v) => !v.newPassword || v.currentPassword, {
    message: "Current password is required",
    path: ["currentPassword"],
  });

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const parsed = await parseBody(req, patchSchema);
  if ("response" in parsed) return parsed.response;

  const nextUsername = parsed.data.username?.toLowerCase();
  const { currentPassword, newPassword, timezone, defaultRange } = parsed.data;

  const updates: Partial<typeof users.$inferInsert> = {};

  if (timezone !== undefined) updates.timezone = timezone;
  if (defaultRange !== undefined) updates.defaultRange = defaultRange;

  if (nextUsername && nextUsername !== auth.user.username) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, nextUsername), ne(users.id, auth.user.id)))
      .limit(1);
    if (existing) return jsonError(409, "Username is already taken");
    updates.username = nextUsername;
  }

  if (newPassword) {
    const valid = await verifyPassword(
      currentPassword ?? "",
      auth.user.passwordHash,
    );
    if (!valid) return jsonError(401, "Current password is incorrect");
    updates.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      user: {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      },
    });
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, auth.user.id))
    .returning({ id: users.id, username: users.username, role: users.role });

  return NextResponse.json({ user: updated });
}
