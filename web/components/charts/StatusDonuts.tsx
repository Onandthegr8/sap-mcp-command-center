"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatusRow } from "@/lib/api";
import { formatInr, formatNumber } from "@/lib/format";
import { COLORS, STATUS_COLOR, tooltipProps } from "./theme";

function Donut({ title, data }: { title: string; data: StatusRow[] }) {
  const total = data.reduce((s, r) => s + r.count, 0);
  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 text-xs font-medium text-slate-400">{title}</div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={42}
              outerRadius={64}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((row) => (
                <Cell key={row.status} fill={STATUS_COLOR[row.status] ?? COLORS.slate} />
              ))}
            </Pie>
            <Tooltip
              {...tooltipProps}
              formatter={(value, _n, item) => {
                const row = item?.payload as StatusRow;
                return [`${formatNumber(Number(value))} · ${formatInr(row?.value_eur)}`, row?.status];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{formatNumber(total)} total</div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {data.map((row) => (
          <span key={row.status} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: STATUS_COLOR[row.status] ?? COLORS.slate }}
            />
            {row.status} ({row.count})
          </span>
        ))}
      </div>
    </div>
  );
}

export function StatusDonuts({ sales, purchases }: { sales: StatusRow[]; purchases: StatusRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Donut title="Sales orders" data={sales} />
      <Donut title="Purchase orders" data={purchases} />
    </div>
  );
}
