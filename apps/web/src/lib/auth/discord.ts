import { z } from "zod";

export const DISCORD_STATE_COOKIE = "mochi_discord_oauth_state";

const discordUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email().nullable(),
  verified: z.boolean().optional(),
});

export type DiscordUser = z.infer<typeof discordUserSchema>;

export function discordConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export async function exchangeDiscordCode(
  code: string,
): Promise<DiscordUser | null> {
  const config = discordConfig();
  if (!config) return null;

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) return null;

  const tokenBody = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof tokenBody.access_token !== "string") return null;

  const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    cache: "no-store",
  });
  if (!userResponse.ok) return null;

  const parsed = discordUserSchema.safeParse(await userResponse.json());
  return parsed.success ? parsed.data : null;
}

/** A valid local username derived from a Discord username and unique ID. */
export function discordUsername(username: string, discordUserId: string): string {
  const base = username
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 23);
  const prefix = base.length >= 3 ? base : "discord";
  return `${prefix}-${discordUserId.slice(-8)}`.slice(0, 32);
}
