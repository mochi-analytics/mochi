import type { Role } from "@/lib/admin";

/**
 * Deployment mode
 * ---------------
 * Mochi runs in one of two modes:
 *
 *   - self-hosted (default): the operator owns the instance. Accounts are
 *     created by the admin, and nothing is quota-limited.
 *   - cloud (`MOCHI_CLOUD=1`): a shared multi-tenant instance. Anyone can
 *     sign up, and each account is limited to a fixed number of owned bots
 *     and teams, and a capped data-retention window.
 *
 * Plan entitlements all flow through the `*For(role)` lookups below so that
 * a future billing system only has to swap the lookups, not touch every
 * route. They all share one rule: self-hosted instances and cloud admins
 * (the operators) are never limited.
 */

export function isCloud(): boolean {
  return process.env.MOCHI_CLOUD === "1";
}

/** Owned-bot quota on the cloud free tier. */
export const CLOUD_BOT_QUOTA = 1;

/** Owned-team quota on the cloud free tier. */
export const CLOUD_TEAM_QUOTA = 1;

/** Retention ceiling on the cloud free tier: half a year. */
export const CLOUD_RETENTION_CAP_DAYS = 183;

function entitlement(
  value: number,
  role: Role,
  cloud: boolean,
): number | null {
  if (!cloud || role === "admin") return null;
  return value;
}

/** Max bots a user may own, or null for unlimited. */
export function botQuotaFor(
  role: Role,
  cloud: boolean = isCloud(),
): number | null {
  return entitlement(CLOUD_BOT_QUOTA, role, cloud);
}

/** Max teams a user may own, or null for unlimited. */
export function teamQuotaFor(
  role: Role,
  cloud: boolean = isCloud(),
): number | null {
  return entitlement(CLOUD_TEAM_QUOTA, role, cloud);
}

/** Max retention days for bots this user owns, or null for uncapped. */
export function retentionCapFor(
  role: Role,
  cloud: boolean = isCloud(),
): number | null {
  return entitlement(CLOUD_RETENTION_CAP_DAYS, role, cloud);
}
