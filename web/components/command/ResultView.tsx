"use client";

// Renders an /api/ask response, auto-formatting the result by shape:
//   array of rows  -> clean table   (trend rows -> inline area chart)
//   single object  -> key/value card
//   no match       -> friendly suggestions

import type { AskResponse, TrendPoint } from "@/lib/api";
import { formatInr, formatNumber } from "@/lib/format";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";

const ARRAY_KEYS = ["rows", "materials", "sales_orders", "purchase_orders", "deliveries", "plants", "queries", "steps"];
const OBJECT_KEYS = ["material", "customer", "vendor"];

function fmtCell(key: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "number") return key.toLowerCase().includes("eur") ? formatInr(val) : formatNumber(val);
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

// Drop the legacy `_eur` suffix from auto-derived labels (amounts are formatted in ₹).
const prettyKey = (key: string) => key.replace(/_eur$/i, "").replace(/_/g, " ").trim();

function GenericTable({ rows }: { rows: Record<string, unknown>[] }) {
  const display = rows.slice(0, 12);
  const cols = Object.keys(display[0] ?? {});
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-800/30 text-left text-slate-500">
            {cols.map((c) => (
              <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium uppercase tracking-wide">
                {prettyKey(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map((r, i) => (
            <tr key={i} className="border-b border-slate-800/50 last:border-0">
              {cols.map((c) => (
                <td key={c} className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-300">
                  {fmtCell(c, r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > display.length && (
        <div className="px-2 py-1 text-[11px] text-slate-500">+{rows.length - display.length} more rows</div>
      )}
    </div>
  );
}

function KeyValueCard({ obj }: { obj: Record<string, unknown> }) {
  return (
    <div className="space-y-1 rounded-lg border border-slate-800 p-3 text-xs">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <span className="text-slate-500">{prettyKey(k)}</span>
          <span className="text-right tabular-nums text-slate-200">{fmtCell(k, v)}</span>
        </div>
      ))}
    </div>
  );
}

function isTrend(rows: Record<string, unknown>[]): boolean {
  return rows.length > 0 && rows[0] != null && "month" in rows[0] && "revenue_eur" in rows[0];
}

export function ResultView({ data }: { data: AskResponse }) {
  if (!data.matched) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-300">{data.explanation}</p>
        <ul className="flex flex-wrap gap-1.5">
          {(data.suggestions ?? []).map((s) => (
            <li key={s} className="rounded-md border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-xs text-slate-300">
              {s}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const result = data.result as Record<string, unknown> | null;
  let body: React.ReactNode = null;

  if (result && typeof result === "object") {
    const arrKey = ARRAY_KEYS.find((k) => Array.isArray(result[k]));
    if (arrKey) {
      const rows = result[arrKey] as Record<string, unknown>[];
      if (isTrend(rows)) body = <SalesTrendChart data={rows as unknown as TrendPoint[]} />;
      else if (rows.length === 0) body = <p className="text-xs text-slate-500">No rows returned.</p>;
      else body = <GenericTable rows={rows} />;
    } else {
      const objKey = OBJECT_KEYS.find((k) => result[k] && typeof result[k] === "object");
      body = <KeyValueCard obj={(objKey ? result[objKey] : result) as Record<string, unknown>} />;
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-200">{data.explanation}</p>
      {body}
    </div>
  );
}
