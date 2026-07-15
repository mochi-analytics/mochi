/**
 * Canonical Mochi project site.
 *
 * Attribution links on public, embeddable surfaces (share pages, widgets, and
 * badges) point here — deliberately at the project, not the local instance —
 * so every shared dashboard drives discovery of Mochi itself. This is the
 * viral loop: someone shows off their bot's stats, a viewer sees "stats by
 * Mochi", and can click through to find out what Mochi is.
 *
 * The `ref` marks which surface sent the visitor. Keep it small and honest;
 * it is for attribution, not tracking individuals.
 */
export const MOCHI_SITE_URL = "https://mochi.software";

export function mochiAttributionUrl(ref: string): string {
  return `${MOCHI_SITE_URL}?ref=${encodeURIComponent(ref)}`;
}
