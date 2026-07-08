import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { invalidateKeyCache } from "@/lib/ingest";

type Params = { params: Promise<{ botId: string; keyId: string }> };

/** Revokes (does not delete) an API key. */
export async function DELETE(_req: Request, { params }: Params) {
  const { botId, keyId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;
  if (!z.string().uuid().safeParse(keyId).success) {
    return jsonError(404, "API key not found");
  }

  const updated = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.botId, access.bot.id),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning({ id: apiKeys.id });

  if (updated.length === 0) {
    return jsonError(404, "API key not found or already revoked");
  }
  invalidateKeyCache();
  return NextResponse.json({ ok: true });
}
