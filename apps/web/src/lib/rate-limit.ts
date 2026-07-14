import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { rateLimitAttempts } from "@/lib/db/schema";

export type RateLimitRule = { limit: number; windowMs: number };

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/**
 * Durable sliding-window limiter. The advisory lock serializes checks for the
 * same key, so parallel requests cannot all observe a free final slot.
 */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
    );

    // Expiry is stored per event, so this cleanup is safe across rules that
    // use different window lengths.
    await tx
      .delete(rateLimitAttempts)
      .where(lte(rateLimitAttempts.expiresAt, now));

    const recent = await tx
      .select({ expiresAt: rateLimitAttempts.expiresAt })
      .from(rateLimitAttempts)
      .where(
        and(
          eq(rateLimitAttempts.key, key),
          gt(rateLimitAttempts.expiresAt, now),
        ),
      )
      .orderBy(asc(rateLimitAttempts.expiresAt))
      .limit(rule.limit);

    if (recent.length >= rule.limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((recent[0].expiresAt.getTime() - now.getTime()) / 1000),
        ),
      };
    }

    await tx.insert(rateLimitAttempts).values({
      key,
      expiresAt: new Date(now.getTime() + rule.windowMs),
      createdAt: now,
    });
    return { ok: true };
  });
}

/** Best-effort client IP from the reverse proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Applies a rule keyed on route + client IP. */
export async function rateLimitResponse(
  req: Request,
  route: string,
  rule: RateLimitRule,
) {
  const result = await checkRateLimit(`${route}:${clientIp(req)}`, rule);
  if (result.ok) return null;
  const res = jsonError(429, "Too many attempts — try again later");
  res.headers.set("Retry-After", String(result.retryAfterSeconds));
  return res;
}
