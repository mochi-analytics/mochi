import { describe, expect, it } from "vitest";
import {
  botQuotaFor,
  CLOUD_BOT_QUOTA,
  CLOUD_RETENTION_CAP_DAYS,
  CLOUD_TEAM_QUOTA,
  retentionCapFor,
  teamQuotaFor,
} from "@/lib/deployment";

describe("botQuotaFor", () => {
  it("never limits self-hosted instances", () => {
    expect(botQuotaFor("admin", false)).toBeNull();
    expect(botQuotaFor("user", false)).toBeNull();
    expect(botQuotaFor("viewer", false)).toBeNull();
  });

  it("limits cloud users but not cloud admins", () => {
    expect(botQuotaFor("user", true)).toBe(CLOUD_BOT_QUOTA);
    expect(botQuotaFor("viewer", true)).toBe(CLOUD_BOT_QUOTA);
    expect(botQuotaFor("admin", true)).toBeNull();
  });
});

describe("teamQuotaFor", () => {
  it("never limits self-hosted instances", () => {
    expect(teamQuotaFor("user", false)).toBeNull();
  });

  it("limits cloud users but not cloud admins", () => {
    expect(teamQuotaFor("user", true)).toBe(CLOUD_TEAM_QUOTA);
    expect(teamQuotaFor("admin", true)).toBeNull();
  });
});

describe("retentionCapFor", () => {
  it("never caps self-hosted instances", () => {
    expect(retentionCapFor("user", false)).toBeNull();
  });

  it("caps cloud users at half a year but not cloud admins", () => {
    expect(retentionCapFor("user", true)).toBe(CLOUD_RETENTION_CAP_DAYS);
    expect(retentionCapFor("viewer", true)).toBe(CLOUD_RETENTION_CAP_DAYS);
    expect(retentionCapFor("admin", true)).toBeNull();
  });
});
