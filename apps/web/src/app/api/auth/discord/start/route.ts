import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DISCORD_STATE_COOKIE, discordConfig } from "@/lib/auth/discord";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isCloud } from "@/lib/deployment";
import { clientIp, rateLimitResponse } from "@/lib/rate-limit";

const OAUTH_RULE = { limit: 10, windowMs: 60 * 60 * 1000 };

function loginError(req: Request, message: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, req.url),
    303,
  );
}

export async function POST(req: Request) {
  if (!isCloud()) return new NextResponse(null, { status: 404 });

  const [existing] = await db.select({ id: users.id }).from(users).limit(1);
  if (!existing) return NextResponse.redirect(new URL("/setup", req.url), 303);

  const limited = await rateLimitResponse(req, "discord-oauth", OAUTH_RULE);
  if (limited) {
    const response = loginError(req, "Too many attempts; please try again later");
    response.headers.set("Retry-After", limited.headers.get("Retry-After") ?? "60");
    return response;
  }

  const config = discordConfig();
  if (!config || !process.env.TURNSTILE_SECRET_KEY) {
    return loginError(req, "Discord sign-in is not configured");
  }

  const form = await req.formData();
  const token = form.get("cf-turnstile-response");
  if (
    typeof token !== "string" ||
    !(await verifyTurnstile(token, clientIp(req)))
  ) {
    return loginError(req, "Please complete the security check and try again");
  }

  const state = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(DISCORD_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "identify email",
    state,
  }).toString();
  return NextResponse.redirect(authorizeUrl, 303);
}
