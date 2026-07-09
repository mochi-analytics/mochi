import { describe, expect, it } from "vitest";
import { decideErrorSpike, decideGuildDrop, decideOffline } from "@/lib/alerts";

const NOW = Date.UTC(2026, 6, 8, 12, 0, 0);

describe("decideOffline", () => {
  it("fires once when snapshots stop", () => {
    expect(
      decideOffline({ minutesSinceLastSnapshot: 20, thresholdMinutes: 15, active: false }),
    ).toBe("fire");
    expect(
      decideOffline({ minutesSinceLastSnapshot: 20, thresholdMinutes: 15, active: true }),
    ).toBe("none");
  });

  it("recovers once when snapshots resume", () => {
    expect(
      decideOffline({ minutesSinceLastSnapshot: 2, thresholdMinutes: 15, active: true }),
    ).toBe("recover");
    expect(
      decideOffline({ minutesSinceLastSnapshot: 2, thresholdMinutes: 15, active: false }),
    ).toBe("none");
  });

  it("ignores bots with no snapshots in the lookback (decommissioned or never instrumented)", () => {
    expect(
      decideOffline({ minutesSinceLastSnapshot: null, thresholdMinutes: 15, active: false }),
    ).toBe("none");
    expect(
      decideOffline({ minutesSinceLastSnapshot: null, thresholdMinutes: 15, active: true }),
    ).toBe("none");
  });
});

describe("decideErrorSpike", () => {
  const base = { thresholdPct: 10, lastFiredAt: null, now: NOW };

  it("fires when the failure rate crosses the threshold", () => {
    expect(decideErrorSpike({ ...base, commands: 100, failures: 15 })).toBe(true);
  });

  it("stays quiet below the threshold", () => {
    expect(decideErrorSpike({ ...base, commands: 100, failures: 5 })).toBe(false);
  });

  it("requires a minimum sample so 1 failure of 2 commands doesn't page", () => {
    expect(decideErrorSpike({ ...base, commands: 2, failures: 1 })).toBe(false);
  });

  it("respects the cooldown", () => {
    const recentFire = new Date(NOW - 30 * 60_000);
    const oldFire = new Date(NOW - 2 * 60 * 60_000);
    expect(
      decideErrorSpike({ ...base, commands: 100, failures: 15, lastFiredAt: recentFire }),
    ).toBe(false);
    expect(
      decideErrorSpike({ ...base, commands: 100, failures: 15, lastFiredAt: oldFire }),
    ).toBe(true);
  });
});

describe("decideGuildDrop", () => {
  const base = { thresholdPct: 5, lastFiredAt: null, now: NOW };

  it("fires on a drop at/above the threshold", () => {
    expect(decideGuildDrop({ ...base, current: 90, previous: 100 })).toBe(true);
  });

  it("stays quiet below the threshold or on growth", () => {
    expect(decideGuildDrop({ ...base, current: 97, previous: 100 })).toBe(false);
    expect(decideGuildDrop({ ...base, current: 110, previous: 100 })).toBe(false);
  });

  it("ignores tiny bots where one guild is a huge percentage", () => {
    expect(decideGuildDrop({ ...base, current: 3, previous: 5 })).toBe(false);
  });

  it("respects the daily cooldown", () => {
    expect(
      decideGuildDrop({
        ...base,
        current: 90,
        previous: 100,
        lastFiredAt: new Date(NOW - 60 * 60_000),
      }),
    ).toBe(false);
    expect(
      decideGuildDrop({
        ...base,
        current: 90,
        previous: 100,
        lastFiredAt: new Date(NOW - 25 * 60 * 60_000),
      }),
    ).toBe(true);
  });
});
