import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { botSettings } from "@/lib/db/schema";
import { invalidateKeyCache } from "@/lib/ingest";

type Params = { params: Promise<{ botId: string }> };

/**
 * Rotates the user-hash salt. Existing user hashes become permanently
 * unlinkable to future ones — this anonymizes history and resets unique
 * user continuity from this moment.
 */
export async function POST(_req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  await db
    .update(botSettings)
    .set({ userHashSalt: randomBytes(16).toString("hex") })
    .where(eq(botSettings.botId, access.bot.id));

  // The ingest hot path caches the salt alongside the key.
  invalidateKeyCache();
  return NextResponse.json({ ok: true });
}
