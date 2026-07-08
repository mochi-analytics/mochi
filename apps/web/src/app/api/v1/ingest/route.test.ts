import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashUserId } from "@/lib/ingest";
import { POST } from "./route";

const BOT_ID = "00010203-0405-0607-0809-0a0b0c0d0e0f";
const SALT = "test-salt";

const { insertMock, authenticateIngestMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  authenticateIngestMock: vi.fn(),
}));

vi.mock("@/lib/clickhouse", () => ({
  clickhouse: { insert: insertMock },
}));

vi.mock("@/lib/ingest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ingest")>();
  return { ...actual, authenticateIngest: authenticateIngestMock };
});

/** Minimal Request stand-in: the handler only reads headers and json(). */
function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return {
    headers: new Headers(headers),
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
      return body;
    },
  } as unknown as Request;
}

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue(undefined);
  authenticateIngestMock.mockReset().mockResolvedValue({
    ctx: { botId: BOT_ID, userHashSalt: SALT, apiKeyId: "key-1" },
  });
});

describe("POST /api/v1/ingest", () => {
  it("accepts a valid batch and writes hashed, defaulted rows", async () => {
    const res = await POST(
      makeRequest({
        events: [
          {
            type: "command",
            name: "play",
            guildId: "123456789012345678",
            userId: "876543210987654321",
            success: false,
            durationMs: 120,
          },
          { type: "guild_join" },
        ],
      }),
    );

    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({
      accepted: 2,
      rejected: 0,
      rejections: [],
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const { table, values } = insertMock.mock.calls[0][0];
    expect(table).toBe("events");
    expect(values).toHaveLength(2);

    const [command, join] = values;
    expect(command.bot_id).toBe(BOT_ID);
    expect(command.event_name).toBe("play");
    // Raw Discord user ids must never reach ClickHouse.
    expect(command.user_hash).toBe(hashUserId("876543210987654321", SALT));
    expect(command.user_hash).not.toContain("876543210987654321");
    expect(command.success).toBe(0);
    expect(command.duration_ms).toBe(120);

    expect(join.event_name).toBe("");
    expect(join.guild_id).toBe("0");
    expect(join.channel_type).toBe("other");
    expect(join.success).toBe(1);
    expect(join.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it("returns the auth error response when authentication fails", async () => {
    const denied = new Response(null, { status: 401 });
    authenticateIngestMock.mockResolvedValue({ response: denied });

    const res = await POST(makeRequest({ events: [{ type: "guild_join" }] }));
    expect(res).toBe(denied);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects bodies over 256KB via content-length", async () => {
    const res = await POST(
      makeRequest(
        { events: [{ type: "guild_join" }] },
        { "content-length": String(257 * 1024) },
      ),
    );
    expect(res.status).toBe(413);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 for unparseable JSON", async () => {
    const res = await POST(makeRequest(undefined));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 with issues when the batch fails validation", async () => {
    const res = await POST(makeRequest({ events: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.issues.length).toBeGreaterThan(0);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects events older than 48h without failing the batch", async () => {
    const stale = new Date(Date.now() - 49 * 3_600_000).toISOString();
    const res = await POST(
      makeRequest({
        events: [{ type: "guild_join", ts: stale }, { type: "guild_join" }],
      }),
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ accepted: 1, rejected: 1 });
    expect(body.rejections[0]).toEqual({ index: 0, reason: "event older than 48h" });
    expect(insertMock.mock.calls[0][0].values).toHaveLength(1);
  });

  it("rejects events timestamped more than 5 minutes in the future", async () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    const res = await POST(makeRequest({ events: [{ type: "guild_join", ts: future }] }));

    const body = await res.json();
    expect(body).toMatchObject({ accepted: 0, rejected: 1 });
    expect(body.rejections[0].reason).toBe("event timestamp is in the future");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects command, custom, and error events without a name", async () => {
    const res = await POST(
      makeRequest({
        events: [{ type: "command" }, { type: "custom" }, { type: "error" }],
      }),
    );

    const body = await res.json();
    expect(body).toMatchObject({ accepted: 0, rejected: 3 });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects events whose meta exceeds 2KB", async () => {
    const res = await POST(
      makeRequest({
        events: [{ type: "guild_join", meta: { blob: "x".repeat(2100) } }],
      }),
    );

    const body = await res.json();
    expect(body).toMatchObject({ accepted: 0, rejected: 1 });
    expect(body.rejections[0].reason).toBe("meta exceeds 2KB");
  });

  it("skips the ClickHouse insert when every event is rejected", async () => {
    const res = await POST(makeRequest({ events: [{ type: "command" }] }));
    expect(res.status).toBe(202);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
