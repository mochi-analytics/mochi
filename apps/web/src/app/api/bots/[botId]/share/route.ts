import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";

type Params = { params: Promise<{ botId: string }> };

const bodySchema = z.object({ enabled: z.boolean() });

/** Enables/disables the public read-only dashboard. */
export async function POST(req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  const parsed = await parseBody(req, bodySchema);
  if ("response" in parsed) return parsed.response;

  // Disabling then re-enabling issues a fresh id, revoking old links.
  const shareId = parsed.data.enabled ? randomUUID() : null;
  await db.update(bots).set({ shareId }).where(eq(bots.id, access.bot.id));

  return NextResponse.json({ shareId });
}
