import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessibleBot } from "@/lib/auth/access";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Returns the authenticated user or a ready-to-return 401 response. */
export async function requireUser(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError(401, "Not authenticated") };
  return { user };
}

/** Returns the authenticated admin or a ready-to-return 401/403 response. */
export async function requireAdmin(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError(401, "Not authenticated") };
  if (user.role !== "admin") {
    return { response: jsonError(403, "Admin access required") };
  }
  return { user };
}

/**
 * Resolves a bot the authenticated user can *access* (owner, admin, or via a
 * shared team). Returns the bot + `canWrite`, or a ready-to-return response.
 * Use in GET/read handlers.
 */
export async function requireBotAccess(botId: string): Promise<
  | { user: SessionUser; bot: Awaited<ReturnType<typeof getAccessibleBot>> & {} }
  | { response: NextResponse }
> {
  const auth = await requireUser();
  if ("response" in auth) return auth;

  const bot = await getAccessibleBot(botId, auth.user);
  if (!bot) return { response: jsonError(404, "Bot not found") };
  return { user: auth.user, bot };
}

/**
 * Like {@link requireBotAccess} but additionally requires write permission
 * (blocks `viewer`s). Use in POST/PATCH/DELETE handlers that mutate a bot.
 */
export async function requireBotWrite(botId: string): Promise<
  | { user: SessionUser; bot: Awaited<ReturnType<typeof getAccessibleBot>> & {} }
  | { response: NextResponse }
> {
  const access = await requireBotAccess(botId);
  if ("response" in access) return access;
  if (!access.bot.canWrite) {
    return { response: jsonError(403, "Read-only access") };
  }
  return access;
}

export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: jsonError(400, "Invalid JSON body") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}
