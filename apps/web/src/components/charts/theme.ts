/**
 * Chart color roles from the validated reference palette (dataviz skill).
 * Categorical slots are assigned to entities, never cycled:
 *   commands/activity → slot 1 (blue), joins → slot 2 (aqua),
 *   leaves → slot 6 (red).
 * Values resolve through CSS variables (globals.css) so charts follow the
 * light/dark theme; both modes are validated there.
 */
export const viz = {
  commands: "var(--viz-commands)",
  joins: "var(--viz-joins)",
  leaves: "var(--viz-leaves)",
  grid: "var(--viz-grid)",
  axis: "var(--viz-axis)",
  muted: "var(--viz-muted)",
  inkPrimary: "var(--viz-ink-primary)",
  inkSecondary: "var(--viz-ink-secondary)",
  surface: "var(--viz-surface)",
  deltaGood: "var(--viz-delta-good)",
  deltaBad: "var(--viz-delta-bad)",
  border: "var(--viz-border)",
  cursor: "var(--viz-cursor)",
} as const;

export const AXIS_TICK = { fill: viz.muted, fontSize: 11 } as const;
