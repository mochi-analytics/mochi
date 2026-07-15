import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  discordUsername,
  DISCORD_STATE_COOKIE,
  exchangeDiscordCode,
} from "@/lib/auth/discord";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isCloud } from "@/lib/deployment";
import { rateLimitResponse } from "@/lib/rate-limit";

const CALLBACK_RULE = { limit: 20, windowMs: 60 * 60 * 1000 };

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function loginError(req: Request, message: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, req.url),
  );
}

export async function GET(req: Request) {
  if (!isCloud()) return new NextResponse(null, { status: 404 });

  const limited = await rateLimitResponse(
    req,
    "discord-callback",
    CALLBACK_RULE,
  );
  if (limited) {
    const response = loginError(req, "Too many attempts; please try again later");
    response.headers.set("Retry-After", limited.headers.get("Retry-After") ?? "60");
    return response;
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(DISCORD_STATE_COOKIE)?.value;
  cookieStore.delete(DISCORD_STATE_COOKIE);

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return loginError(req, "Discord sign-in expired; please try again");
  }

  const discordUser = await exchangeDiscordCode(code);
  if (!discordUser) return loginError(req, "Discord sign-in failed");
  if (!discordUser.email || discordUser.verified !== true) {
    return loginError(req, "Discord requires a verified email address");
  }

  const email = discordUser.email.trim().toLowerCase();
  const [byDiscord] = await db
    .select()
    .from(users)
    .where(eq(users.discordUserId, discordUser.id))
    .limit(1);
  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (byDiscord && byEmail && byDiscord.id !== byEmail.id) {
    return loginError(req, "That email is already connected to another account");
  }
  if (byEmail?.discordUserId && byEmail.discordUserId !== discordUser.id) {
    return loginError(req, "That email is already connected to another account");
  }

  let user = byDiscord ?? byEmail;
  if (user) {
    const [emailOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, user.id)))
      .limit(1);
    if (emailOwner) {
      return loginError(req, "That email is already connected to another account");
    }
    const [updated] = await db
      .update(users)
      .set({ discordUserId: discordUser.id, email })
      .where(eq(users.id, user.id))
      .returning();
    user = updated;
  } else {
    const username = discordUsername(discordUser.username, discordUser.id);
    let [created] = await db
      .insert(users)
      .values({
        username,
        email,
        discordUserId: discordUser.id,
        passwordHash: null,
        role: "user",
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      // A simultaneous callback may have created the same identity. Resolve
      // that safely; a username-only collision remains an explicit failure.
      const [concurrent] = await db
        .select()
        .from(users)
        .where(eq(users.discordUserId, discordUser.id))
        .limit(1);
      if (concurrent) {
        user = concurrent;
      } else {
        // The preferred display name may already belong to an older account.
        // Discord snowflakes are globally unique and fit the local limit.
        [created] = await db
          .insert(users)
          .values({
            username: `discord-${discordUser.id}`,
            email,
            discordUserId: discordUser.id,
            passwordHash: null,
            role: "user",
          })
          .onConflictDoNothing()
          .returning();
        if (!created) {
          return loginError(req, "Could not create the account; please try again");
        }
        user = created;
      }
    } else {
      user = created;
    }
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL("/bots", req.url));
}
