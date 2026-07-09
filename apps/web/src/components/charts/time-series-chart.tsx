"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
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
 * title names it. An optional `previous` series (same x positions, values
 * from the preceding period) renders as a dashed muted line behind the main
 * one, with a small legend so the dashes are named.
 */
export function TimeSeriesChart({
  data,
  bucket,
  label,
  color = viz.commands,
  height = 240,
  previous,
}: {
  data: { t: number; value: number }[];
  bucket: "minute" | "hour" | "day";
  label: string;
  color?: string;
  height?: number;
  previous?: { t: number; value: number }[];
}) {
  const prevByT = previous && new Map(previous.map((p) => [p.t, p.value]));
  const merged = prevByT
    ? data.map((point) => ({ ...point, previous: prevByT.get(point.t) ?? 0 }))
    : data;
  const series = [
    { key: "value", label, color },
    ...(prevByT
      ? [{ key: "previous", label: "Previous period", color: viz.compare }]
      : []),
  ];
  return (
    <div>
      {prevByT && (
        <div className="mb-2 flex gap-4">
          {series.map((s) => (
            <span
              key={s.key}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: viz.inkSecondary }}
            >
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
              series={series}
            />
          )}
        />
        {prevByT && (
          <Line
            type="monotone"
            dataKey="previous"
            stroke={viz.compare}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        )}
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
    </div>
  );
}
