"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlantInventory } from "@/lib/api";
import { formatInr, formatInrCompact } from "@/lib/format";
import { AXIS_TICK, GRID, SERIES, tooltipProps } from "./theme";

export function InventoryByPlantChart({ data }: { data: PlantInventory[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="plant_name" tick={AXIS_TICK} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis
            tickFormatter={(v) => formatInrCompact(Number(v))}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            {...tooltipProps}
            cursor={{ fill: "#1e293b55" }}
            formatter={(value) => [formatInr(Number(value)), "Inventory value"]}
          />
          <Bar dataKey="inventory_value_eur" radius={[4, 4, 0, 0]} maxBarSize={64}>
            {data.map((_, i) => (
              <Cell key={i} fill={SERIES[i % SERIES.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
