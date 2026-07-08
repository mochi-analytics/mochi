"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatTick } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";
import { AXIS_TICK, viz } from "./theme";

/**
 * Single-series time chart: 2px line with a 10% wash underneath, hairline
 * horizontal grid, crosshair tooltip. One series → no legend box; the card
 * title names it.
 */
export function TimeSeriesChart({
  data,
  bucket,
  label,
  color = viz.commands,
  height = 240,
}: {
  data: { t: number; value: number }[];
  bucket: "minute" | "hour" | "day";
  label: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={viz.grid} strokeWidth={1} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
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
          cursor={{ stroke: viz.axis, strokeWidth: 1 }}
          content={(props) => (
            <ChartTooltip
              active={props.active}
              label={props.label as number}
              payload={props.payload as never}
              bucket={bucket}
              series={[{ key: "value", label, color }]}
            />
          )}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={color}
          fillOpacity={0.1}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: viz.surface }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
