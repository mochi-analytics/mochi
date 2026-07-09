import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { alertConfigs } from "@/lib/db/schema";
import {
  EMBED_COLORS,
  isDiscordWebhookUrl,
  sendDiscordWebhook,
} from "@/lib/discord";

type Params = { params: Promise<{ botId: string }> };

const bodySchema = z.object({
  // Optional so the form can test a URL before it has been saved.
  webhookUrl: z
    .string()
    .max(400)
    .refine(isDiscordWebhookUrl, "Must be a Discord webhook URL")
    .optional(),
});

/** Sends a test message to the given (or saved) webhook. */
export async function POST(req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  const parsed = await parseBody(req, bodySchema);
  if ("response" in parsed) return parsed.response;

  let url = parsed.data.webhookUrl;
  if (!url) {
    const [config] = await db
      .select({ webhookUrl: alertConfigs.webhookUrl })
      .from(alertConfigs)
      .where(eq(alertConfigs.botId, access.bot.id))
      .limit(1);
    url = config?.webhookUrl;
  }
  if (!url) return jsonError(400, "No webhook URL configured");

  const ok = await sendDiscordWebhook(url, [
    {
      title: `👋 Test message for ${access.bot.name}`,
      description:
        "Mochi can reach this webhook. Alerts and digests will arrive here.",
      color: EMBED_COLORS.blue,
      timestamp: new Date().toISOString(),
    },
  ]);
  if (!ok) return jsonError(502, "Discord rejected the webhook message");
  return NextResponse.json({ ok: true });
}
