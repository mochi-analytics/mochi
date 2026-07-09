"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatTick } from "@/lib/format";
import { ChartTooltip, type TooltipSeries } from "./chart-tooltip";
import { AXIS_TICK, viz } from "./theme";

/**
 * Two-to-three line series on one time axis → legend always present,
 * shared crosshair tooltip. Used for errors (error events vs failed
 * commands) and ping (average vs worst).
 */
export function MultiLineChart({
  data,
  series,
  bucket,
  height = 240,
}: {
  data: ({ t: number } & Record<string, number>)[];
  series: TooltipSeries[];
  bucket: "minute" | "hour" | "day";
  height?: number;
}) {
  return (
    <div>
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
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: viz.surface }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
