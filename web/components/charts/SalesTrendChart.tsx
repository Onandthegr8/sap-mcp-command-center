"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/api";
import { formatInr, formatInrCompact, formatMonth } from "@/lib/format";
import { AXIS_TICK, COLORS, GRID, tooltipProps } from "./theme";

export function SalesTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.sky} stopOpacity={0.45} />
              <stop offset="100%" stopColor={COLORS.sky} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={AXIS_TICK}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v) => formatInrCompact(Number(v))}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            {...tooltipProps}
            formatter={(value) => [formatInr(Number(value)), "Revenue"]}
            labelFormatter={(label) => formatMonth(String(label))}
          />
          <Area type="monotone" dataKey="revenue_eur" stroke={COLORS.sky} strokeWidth={2} fill="url(#revFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
