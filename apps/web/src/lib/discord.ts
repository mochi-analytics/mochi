/**
 * Minimal Discord webhook client for alerts and digests. Only real Discord
 * webhook URLs are accepted (validated again at send time), so a stored
 * config can never be pointed at an internal service (SSRF).
 */

const WEBHOOK_URL_RE =
  /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isDiscordWebhookUrl(url: string): boolean {
  return WEBHOOK_URL_RE.test(url);
}

export type DiscordEmbed = {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
  footer?: { text: string };
};

export const EMBED_COLORS = {
  red: 0xef4444,
  green: 0x22c55e,
  amber: 0xf59e0b,
  blue: 0x3b82f6,
} as const;

/**
 * Posts embeds to a Discord webhook. Returns false (never throws) on any
 * failure — alerting must never take the sweep loop down.
 */
export async function sendDiscordWebhook(
  url: string,
  embeds: DiscordEmbed[],
): Promise<boolean> {
  if (!isDiscordWebhookUrl(url)) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Mochi", embeds }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
