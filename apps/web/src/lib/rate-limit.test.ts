import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clientIp, resetRateLimits } from "@/lib/rate-limit";

const RULE = { limit: 3, windowMs: 60_000 };

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then blocks with a retry hint", () => {
    const t0 = 1_000_000;
    expect(checkRateLimit("k", RULE, t0)).toEqual({ ok: true });
    expect(checkRateLimit("k", RULE, t0 + 1)).toEqual({ ok: true });
    expect(checkRateLimit("k", RULE, t0 + 2)).toEqual({ ok: true });

    const blocked = checkRateLimit("k", RULE, t0 + 3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      // First attempt leaves the window 60s after t0.
      expect(blocked.retryAfterSeconds).toBe(60);
    }
  });

  it("frees slots as attempts age out of the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("k", RULE, t0);
    // Attempts at exactly the window edge still count…
    expect(checkRateLimit("k", RULE, t0 + RULE.windowMs).ok).toBe(false);
    // …and age out one tick later.
    expect(checkRateLimit("k", RULE, t0 + RULE.windowMs + 1).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("a", RULE, t0 + i);
    expect(checkRateLimit("a", RULE, t0 + 4).ok).toBe(false);
    expect(checkRateLimit("b", RULE, t0 + 4).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(
      clientIp(new Request("http://x", { headers: { "x-real-ip": "198.51.100.4" } })),
    ).toBe("198.51.100.4");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
