import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, tx, selectRows, insertValues } = vi.hoisted(() => {
  const selectRows: { expiresAt: Date }[] = [];
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([...selectRows])),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: insertValues })),
  };
  const dbMock = {
    transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return { dbMock, tx, selectRows, insertValues };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const RULE = { limit: 3, windowMs: 60_000 };

describe("checkRateLimit", () => {
  beforeEach(() => {
    selectRows.length = 0;
    vi.clearAllMocks();
  });

  it("records an allowed attempt in a serialized transaction", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    await expect(checkRateLimit("signup:ip", RULE, now)).resolves.toEqual({
      ok: true,
    });

    expect(dbMock.transaction).toHaveBeenCalledOnce();
    expect(tx.execute).toHaveBeenCalledOnce();
    expect(insertValues).toHaveBeenCalledWith({
      key: "signup:ip",
      expiresAt: new Date("2026-01-01T00:01:00Z"),
      createdAt: now,
    });
  });

  it("blocks at the limit and returns the earliest expiry", async () => {
    selectRows.push(
      { expiresAt: new Date("2026-01-01T00:00:20Z") },
      { expiresAt: new Date("2026-01-01T00:00:30Z") },
      { expiresAt: new Date("2026-01-01T00:00:40Z") },
    );

    await expect(
      checkRateLimit("signup:ip", RULE, new Date("2026-01-01T00:00:00Z")),
    ).resolves.toEqual({ ok: false, retryAfterSeconds: 20 });
    expect(insertValues).not.toHaveBeenCalled();
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
      clientIp(
        new Request("http://x", {
          headers: { "x-real-ip": "198.51.100.4" },
        }),
      ),
    ).toBe("198.51.100.4");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
