import { afterEach, describe, expect, it, vi } from "vitest";
import { discordUsername, exchangeDiscordCode } from "@/lib/auth/discord";

describe("discordUsername", () => {
  it("creates a valid stable local username", () => {
    expect(discordUsername("Mochi Fan!", "123456789012345678")).toBe(
      "mochi-fan-12345678",
    );
  });

  it("falls back when Discord characters cannot be used locally", () => {
    expect(discordUsername("🍡", "123456789012345678")).toBe(
      "discord-12345678",
    );
  });
});

describe("exchangeDiscordCode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("exchanges a code and validates the Discord user response", async () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "client");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "secret");
    vi.stubEnv("DISCORD_REDIRECT_URI", "https://mochi.test/callback");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "123",
            username: "mochi",
            email: "USER@example.com",
            verified: true,
          }),
          { status: 200 },
        ),
      );

    await expect(exchangeDiscordCode("code")).resolves.toMatchObject({
      id: "123",
      verified: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
