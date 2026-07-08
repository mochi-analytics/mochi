import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatCompact,
  formatMs,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTick,
  formatTooltipTime,
} from "@/lib/format";

describe("formatCompact", () => {
  it("uses plain formatting below 10,000", () => {
    expect(formatCompact(9999)).toBe("9,999");
  });

  it("uses compact notation from 10,000 up", () => {
    expect(formatCompact(10_000)).toBe("10K");
    expect(formatCompact(1_500_000)).toBe("1.5M");
  });
});

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});

describe("formatMs", () => {
  it("shows a dash for zero or negative durations", () => {
    expect(formatMs(0)).toBe("—");
    expect(formatMs(-5)).toBe("—");
  });

  it("rounds sub-second values to milliseconds", () => {
    expect(formatMs(499.6)).toBe("500ms");
  });

  it("converts values of a second or more to seconds", () => {
    expect(formatMs(1000)).toBe("1.0s");
    expect(formatMs(2345)).toBe("2.3s");
  });
});

describe("formatPercent", () => {
  it("formats to one decimal place", () => {
    expect(formatPercent(99.99)).toBe("100.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("formatTick", () => {
  const noonUtc = Date.UTC(2026, 6, 8, 12, 30);

  it("shows month and day for day buckets", () => {
    expect(formatTick(noonUtc, "day")).toBe("Jul 8");
  });

  it("shows 24h time for hour and minute buckets", () => {
    expect(formatTick(noonUtc, "hour")).toBe("12:30");
    expect(formatTick(noonUtc, "minute")).toBe("12:30");
  });
});

describe("formatTooltipTime", () => {
  const noonUtc = Date.UTC(2026, 6, 8, 12, 30);

  it("shows weekday for day buckets", () => {
    expect(formatTooltipTime(noonUtc, "day")).toBe("Wed, Jul 8");
  });

  it("shows date and UTC time for finer buckets", () => {
    expect(formatTooltipTime(noonUtc, "hour")).toBe("Jul 8, 12:30 UTC");
  });
});

describe("formatRelative", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("scales through seconds, minutes, hours, and days", () => {
    vi.useFakeTimers();
    const now = Date.now();
    expect(formatRelative(now - 30_000)).toBe("30s ago");
    expect(formatRelative(now - 5 * 60_000)).toBe("5m ago");
    expect(formatRelative(now - 3 * 3_600_000)).toBe("3h ago");
    expect(formatRelative(now - 2 * 86_400_000)).toBe("2d ago");
  });

  it("never reports less than one second", () => {
    vi.useFakeTimers();
    expect(formatRelative(Date.now())).toBe("1s ago");
  });
});
