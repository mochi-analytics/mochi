import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys, botSettings, bots } from "@/lib/db/schema";

export type IngestContext = {
  botId: string;
  userHashSalt: string;
  apiKeyId: string;
};

type CacheEntry = { ctx: IngestContext | null; expiresAt: number };

// Hot-path caches. Single-instance only — acceptable per the v1 design.
const keyCache = new Map<string, CacheEntry>();
const KEY_CACHE_TTL_MS = 60_000;

const lastUsedWritten = new Map<string, number>();
const LAST_USED_THROTTLE_MS = 60_000;

const buckets = new Map<string, { tokens: number; updatedAt: number }>();
const RATE_LIMIT_PER_MINUTE = 120; // requests; a full batch is 100 events
const BUCKET_CAPACITY = 240;

export function jsonError(status: number, message: string, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function hashUserId(userId: string, salt: string): string {
  // 64-bit truncated hash: enough for unique counting, useless for lookup.
  return createHash("sha256")
    .update(`${salt}:${userId}`)
    .digest("hex")
    .slice(0, 16);
}

/** Resolves a Bearer API key to its bot, or an error response. */
export async function authenticateIngest(
  req: Request,
): Promise<{ ctx: IngestContext } | { response: NextResponse }> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(mochi_sk_[A-Za-z0-9_-]+)$/.exec(header);
  if (!match) {
    return { response: jsonError(401, "Missing or malformed API key") };
  }

  const keyHash = createHash("sha256").update(match[1]).digest("hex");
  const cached = keyCache.get(keyHash);
  let ctx: IngestContext | null;

  if (cached && cached.expiresAt > Date.now()) {
    ctx = cached.ctx;
  } else {
    const rows = await db
      .select({
        apiKeyId: apiKeys.id,
        botId: bots.id,
        userHashSalt: botSettings.userHashSalt,
      })
      .from(apiKeys)
      .innerJoin(bots, eq(apiKeys.botId, bots.id))
      .innerJoin(botSettings, eq(botSettings.botId, bots.id))
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);
    ctx = rows[0] ?? null;
    keyCache.set(keyHash, { ctx, expiresAt: Date.now() + KEY_CACHE_TTL_MS });
  }

  if (!ctx) {
    return { response: jsonError(401, "Invalid or revoked API key") };
  }

  if (!takeToken(ctx.apiKeyId)) {
    return {
      response: NextResponse.json(
        { error: "Rate limited" },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    };
  }

  touchLastUsed(ctx.apiKeyId);
  return { ctx };
}

function takeToken(apiKeyId: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(apiKeyId) ?? {
    tokens: BUCKET_CAPACITY,
    updatedAt: now,
  };
  bucket.tokens = Math.min(
    BUCKET_CAPACITY,
    bucket.tokens + ((now - bucket.updatedAt) / 60_000) * RATE_LIMIT_PER_MINUTE,
  );
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(apiKeyId, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(apiKeyId, bucket);
  return true;
}

function touchLastUsed(apiKeyId: string) {
  const now = Date.now();
  const last = lastUsedWritten.get(apiKeyId) ?? 0;
  if (now - last < LAST_USED_THROTTLE_MS) return;
  lastUsedWritten.set(apiKeyId, now);
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKeyId))
    .catch(() => {
      // Best-effort metadata; never fail ingest over it.
    });
}

/** Invalidate cache entries after key revocation (same-instance only). */
export function invalidateKeyCache() {
  keyCache.clear();
}
