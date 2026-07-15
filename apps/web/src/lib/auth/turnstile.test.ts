import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "@/lib/auth/turnstile";

describe("verifyTurnstile", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("accepts only successful tokens for the Discord OAuth action", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, action: "discord_oauth" }),
        { status: 200 },
      ),
    );
    await expect(verifyTurnstile("token", "203.0.113.1")).resolves.toBe(true);
  });

  it("fails closed when verification is unavailable", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(verifyTurnstile("token")).resolves.toBe(false);
  });
});
