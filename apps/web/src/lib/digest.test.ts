import { describe, expect, it } from "vitest";
import { buildDigestEmbed, isDigestDue, startOfIsoWeekUtc } from "@/lib/digest";

describe("startOfIsoWeekUtc", () => {
  it("returns Monday 00:00 UTC for any day of the week", () => {
    const monday = Date.UTC(2026, 6, 6); // Mon 2026-07-06
    expect(startOfIsoWeekUtc(Date.UTC(2026, 6, 6, 0, 0, 1))).toBe(monday);
    expect(startOfIsoWeekUtc(Date.UTC(2026, 6, 8, 15, 30))).toBe(monday); // Wed
    expect(startOfIsoWeekUtc(Date.UTC(2026, 6, 12, 23, 59))).toBe(monday); // Sun
  });

  it("rolls Sunday into the preceding Monday's week", () => {
    expect(startOfIsoWeekUtc(Date.UTC(2026, 6, 5, 12))).toBe(Date.UTC(2026, 5, 29));
  });
});

describe("isDigestDue", () => {
  const wednesday = Date.UTC(2026, 6, 8, 12);

  it("is due when never sent", () => {
    expect(isDigestDue(wednesday, null)).toBe(true);
  });

  it("is due when last sent before this week's Monday", () => {
    expect(isDigestDue(wednesday, new Date(Date.UTC(2026, 6, 3)))).toBe(true);
  });

  it("is not due when already sent this week", () => {
    expect(isDigestDue(wednesday, new Date(Date.UTC(2026, 6, 6, 0, 5)))).toBe(false);
  });
});

describe("buildDigestEmbed", () => {
  const stats = {
    guildCount: 1200,
    commands: 45000,
    uniqueUsers: 8000,
    errorRate: 2.4,
    p95Ms: 480,
    joins: 30,
    leaves: 12,
  };

  it("summarizes the week with top commands and errors", () => {
    const embed = buildDigestEmbed(
      "Demo Bot",
      stats,
      [{ name: "play", uses: 20000 }],
      [{ name: "TimeoutError", count: 42 }],
    );
    expect(embed.title).toContain("Demo Bot");
    const byName = Object.fromEntries(embed.fields!.map((f) => [f.name, f.value]));
    expect(byName["Servers"]).toBe("1,200 (+18)");
    expect(byName["Error rate"]).toBe("2.4%");
    expect(byName["Top commands"]).toContain("/play");
    expect(byName["Top errors"]).toContain("TimeoutError");
  });

  it("omits the errors field for a clean week", () => {
    const embed = buildDigestEmbed("Demo Bot", stats, [], []);
    expect(embed.fields!.some((f) => f.name === "Top errors")).toBe(false);
    expect(embed.fields!.find((f) => f.name === "Top commands")!.value).toBe("—");
  });
});
