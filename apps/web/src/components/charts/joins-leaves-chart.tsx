"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatTick } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";
import { AXIS_TICK, viz } from "./theme";

const SERIES = [
  { key: "joins", label: "Joins", color: viz.joins },
  { key: "leaves", label: "Leaves", color: viz.leaves },
];

/**
 * Grouped bars, two series → legend always present. Bars ≤24px with 4px
 * rounded data-ends (square at the baseline); one tooltip lists both series.
 */
export function JoinsLeavesChart({
  data,
  bucket,
  height = 240,
}: {
  data: { t: number; joins: number; leaves: number }[];
  bucket: "hour" | "day";
  height?: number;
}) {
  return (
    <div>
      <div className="mb-2 flex gap-4">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: viz.inkSecondary }}>
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barGap={2}
        >
          <CartesianGrid vertical={false} stroke={viz.grid} strokeWidth={1} />
          <XAxis
            dataKey="t"
            tickFormatter={(t: number) => formatTick(t, bucket)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: viz.axis, strokeWidth: 1 }}
            minTickGap={48}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: viz.cursor }}
            content={(props) => (
              <ChartTooltip
                active={props.active}
                label={props.label as number}
                payload={props.payload as never}
                bucket={bucket}
                series={SERIES}
              />
            )}
          />
          <Bar dataKey="joins" fill={viz.joins} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="leaves" fill={viz.leaves} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
