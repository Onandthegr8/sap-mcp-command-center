// Shared Recharts styling tokens so all charts match the dark command-center palette.

import type { CSSProperties } from "react";

export const COLORS = {
  sky: "#38bdf8",
  emerald: "#34d399",
  violet: "#a78bfa",
  amber: "#fbbf24",
  rose: "#fb7185",
  slate: "#64748b",
};

export const SERIES = [COLORS.sky, COLORS.emerald, COLORS.violet, COLORS.amber, COLORS.rose];

// Map SAP statuses to consistent colors across charts.
export const STATUS_COLOR: Record<string, string> = {
  OPEN: COLORS.sky,
  DELIVERED: COLORS.emerald,
  RECEIVED: COLORS.emerald,
  INVOICED: COLORS.violet,
  CANCELLED: COLORS.rose,
};

export const GRID = "#1e293b";
export const AXIS_TICK = { fill: "#64748b", fontSize: 11 } as const;

export const tooltipProps = {
  contentStyle: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 8,
    fontSize: 12,
  } as CSSProperties,
  labelStyle: { color: "#cbd5e1" } as CSSProperties,
  itemStyle: { color: "#e2e8f0" } as CSSProperties,
};
