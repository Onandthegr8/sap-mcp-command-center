"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CustomerRow } from "@/lib/api";
import { formatInr, formatInrCompact } from "@/lib/format";
import { AXIS_TICK, COLORS, GRID, tooltipProps } from "./theme";

const truncate = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function TopCustomersChart({ data }: { data: CustomerRow[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => formatInrCompact(Number(v))}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickFormatter={(v) => truncate(String(v))}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip
            {...tooltipProps}
            cursor={{ fill: "#1e293b55" }}
            formatter={(value) => [formatInr(Number(value)), "Revenue"]}
          />
          <Bar dataKey="revenue_eur" fill={COLORS.sky} radius={[0, 4, 4, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
