import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { botSettings } from "@/lib/db/schema";
import { retentionCapFor } from "@/lib/deployment";

type Params = { params: Promise<{ botId: string }> };

const patchSchema = z.object({
  retentionDays: z.number().int().min(7).max(3650).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  const parsed = await parseBody(req, patchSchema);
  if ("response" in parsed) return parsed.response;

  const cap = retentionCapFor(access.user.role);
  if (
    cap !== null &&
    parsed.data.retentionDays !== undefined &&
    parsed.data.retentionDays > cap
  ) {
    return jsonError(400, `Retention is limited to ${cap} days`);
  }

  const [updated] = await db
    .update(botSettings)
    .set(parsed.data)
    .where(eq(botSettings.botId, access.bot.id))
    .returning({
      retentionDays: botSettings.retentionDays,
      timezone: botSettings.timezone,
    });

  return NextResponse.json({ settings: updated });
}
