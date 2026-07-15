import { z } from "zod";

const responseSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
});

export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      },
    );
    if (!response.ok) return false;
    const parsed = responseSchema.safeParse(await response.json());
    return (
      parsed.success &&
      parsed.data.success &&
      parsed.data.action === "discord_oauth"
    );
  } catch {
    return false;
  }
}
