import { describe, expect, it, vi } from "vitest";
import { authenticateIngest, hashUserId } from "@/lib/ingest";

const { dbMock } = vi.hoisted(() => {
  const rows: unknown[] = [];
  const chain = {
    rows,
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows.splice(0))),
    update: vi.fn(() => chain),
    set: vi.fn(() => ({ where: () => Promise.resolve() })),
  };
  return { dbMock: chain };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

function requestWithAuth(header?: string): Request {
  return new Request("http://localhost/api/v1/ingest", {
    method: "POST",
    headers: header ? { authorization: header } : {},
  });
}

describe("hashUserId", () => {
  it("produces a 16-char hex hash", () => {
    expect(hashUserId("123456789012345678", "salt")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for the same user and salt", () => {
    expect(hashUserId("123", "salt")).toBe(hashUserId("123", "salt"));
  });

  it("changes when the salt changes", () => {
    expect(hashUserId("123", "salt-a")).not.toBe(hashUserId("123", "salt-b"));
  });

  it("changes when the user changes", () => {
    expect(hashUserId("123", "salt")).not.toBe(hashUserId("456", "salt"));
  });
});

describe("authenticateIngest", () => {
  it("rejects a missing Authorization header without touching the db", async () => {
    const result = await authenticateIngest(requestWithAuth());
    expect("response" in result && result.response.status).toBe(401);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("rejects tokens without the mochi_sk_ prefix", async () => {
    const result = await authenticateIngest(requestWithAuth("Bearer sk_wrong_prefix"));
    expect("response" in result && result.response.status).toBe(401);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("rejects non-Bearer schemes", async () => {
    const result = await authenticateIngest(requestWithAuth("Basic mochi_sk_abc123"));
    expect("response" in result && result.response.status).toBe(401);
  });

  it("rejects keys that do not exist or are revoked", async () => {
    const result = await authenticateIngest(requestWithAuth("Bearer mochi_sk_unknown_key"));
    expect(dbMock.select).toHaveBeenCalled();
    expect("response" in result && result.response.status).toBe(401);
  });

  it("resolves a valid key to its bot context and caches it", async () => {
    const ctx = {
      apiKeyId: "0f0e0d0c-0b0a-0908-0706-050403020100",
      botId: "00010203-0405-0607-0809-0a0b0c0d0e0f",
      userHashSalt: "salt",
    };
    dbMock.rows.push(ctx);
    dbMock.select.mockClear();

    const first = await authenticateIngest(requestWithAuth("Bearer mochi_sk_valid_key"));
    expect("ctx" in first && first.ctx).toEqual(ctx);
    expect(dbMock.select).toHaveBeenCalledTimes(1);

    // Second call must be served from the key cache, not the db.
    const second = await authenticateIngest(requestWithAuth("Bearer mochi_sk_valid_key"));
    expect("ctx" in second && second.ctx).toEqual(ctx);
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });

  it("rate-limits a key once its token bucket is drained", async () => {
    dbMock.rows.push({
      apiKeyId: "11111111-1111-1111-1111-111111111111",
      botId: "22222222-2222-2222-2222-222222222222",
      userHashSalt: "salt",
    });

    let limited: Response | null = null;
    // Bucket capacity is 240; one token was not yet consumed by other tests
    // for this fresh key, so within 241 calls we must hit a 429.
    for (let i = 0; i < 241; i++) {
      const result = await authenticateIngest(requestWithAuth("Bearer mochi_sk_burst_key"));
      if ("response" in result) {
        limited = result.response;
        break;
      }
    }
    expect(limited).not.toBeNull();
    expect(limited!.status).toBe(429);
    expect(limited!.headers.get("Retry-After")).toBe("30");
  });
});
