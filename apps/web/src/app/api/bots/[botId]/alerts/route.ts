import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { alertConfigs, alertStates } from "@/lib/db/schema";
import { isDiscordWebhookUrl } from "@/lib/discord";

type Params = { params: Promise<{ botId: string }> };

const putSchema = z.object({
  webhookUrl: z
    .string()
    .max(400)
    .refine(isDiscordWebhookUrl, "Must be a Discord webhook URL"),
  offlineEnabled: z.boolean(),
  offlineAfterMinutes: z.number().int().min(5).max(1440),
  errorSpikeEnabled: z.boolean(),
  errorRatePct: z.number().int().min(1).max(100),
  guildDropEnabled: z.boolean(),
  guildDropPct: z.number().int().min(1).max(100),
  digestEnabled: z.boolean(),
});

export async function GET(_req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  const [config] = await db
    .select()
    .from(alertConfigs)
    .where(eq(alertConfigs.botId, access.bot.id))
    .limit(1);
  return NextResponse.json({ config: config ?? null });
}

/** Creates or replaces the bot's alert configuration. */
export async function PUT(req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  const parsed = await parseBody(req, putSchema);
  if ("response" in parsed) return parsed.response;

  const values = { botId: access.bot.id, ...parsed.data };
  const [config] = await db
    .insert(alertConfigs)
    .values(values)
    .onConflictDoUpdate({ target: alertConfigs.botId, set: parsed.data })
    .returning();
  return NextResponse.json({ config });
}

/** Removes the alert configuration and any alert state. */
export async function DELETE(_req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  await db.delete(alertConfigs).where(eq(alertConfigs.botId, access.bot.id));
  await db.delete(alertStates).where(eq(alertStates.botId, access.bot.id));
  return NextResponse.json({ ok: true });
}
