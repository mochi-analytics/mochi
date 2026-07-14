import { jsonError } from "@/lib/api";

/**
 * Sliding-window rate limiter, in memory. Per-process state is enough for
 * the single-container cloud deployment; if Mochi ever runs replicated,
 * swap the store for Postgres/Redis behind the same check.
 */

type Rule = { limit: number; windowMs: number };

/** Attempt timestamps per key, oldest first. */
const attempts = new Map<string, number[]>();

// Beyond this many tracked keys, expired entries are swept on the next
// check so an attacker rotating keys can't grow the map without bound.
const SWEEP_THRESHOLD = 10_000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(
  key: string,
  rule: Rule,
  now: number = Date.now(),
): RateLimitResult {
  const cutoff = now - rule.windowMs;

  if (attempts.size > SWEEP_THRESHOLD) {
    for (const [k, times] of attempts) {
      if (times[times.length - 1] < cutoff) attempts.delete(k);
    }
  }

  const recent = (attempts.get(key) ?? []).filter((t) => t >= cutoff);
  if (recent.length >= rule.limit) {
    attempts.set(key, recent);
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((recent[0] + rule.windowMs - now) / 1000),
      ),
    };
  }

  recent.push(now);
  attempts.set(key, recent);
  return { ok: true };
}

/** Test hook. */
export function resetRateLimits(): void {
  attempts.clear();
}

/**
 * Best-effort client IP. Cloud runs behind a reverse proxy, so the first
 * x-forwarded-for hop is the client; direct connections have no header.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Applies a rule keyed on route + client IP. Returns a ready-to-return 429
 * when over the limit, or null to proceed.
 */
export function rateLimitResponse(req: Request, route: string, rule: Rule) {
  const result = checkRateLimit(`${route}:${clientIp(req)}`, rule);
  if (result.ok) return null;
  const res = jsonError(429, "Too many attempts — try again later");
  res.headers.set("Retry-After", String(result.retryAfterSeconds));
  return res;
}
