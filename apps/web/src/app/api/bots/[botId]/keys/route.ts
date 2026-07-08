import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requireBotAccess, requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";

type Params = { params: Promise<{ botId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotAccess(botId);
  if ("response" in access) return access.response;

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.botId, access.bot.id))
    .orderBy(apiKeys.createdAt);
  return NextResponse.json({ keys: rows });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  const parsed = await parseBody(req, createSchema);
  if ("response" in parsed) return parsed.response;

  const key = `mochi_sk_${randomBytes(24).toString("base64url")}`;
  const [created] = await db
    .insert(apiKeys)
    .values({
      botId: access.bot.id,
      name: parsed.data.name,
      keyHash: createHash("sha256").update(key).digest("hex"),
      keyPrefix: key.slice(0, 14),
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      createdAt: apiKeys.createdAt,
    });

  // `key` is returned exactly once and never stored in plaintext.
  return NextResponse.json({ key, apiKey: created }, { status: 201 });
}
