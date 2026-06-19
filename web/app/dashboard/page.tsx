"use client";

import { getDashboard, type MaterialRevRow } from "@/lib/api";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatInr, formatNumber } from "@/lib/format";
import { Panel } from "@/components/Panel";
import { KpiCard } from "@/components/KpiCard";
import { DataTable, type Column } from "@/components/DataTable";
import { ChartSkeleton, ErrorState, KpiSkeleton } from "@/components/States";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { InventoryByPlantChart } from "@/components/charts/InventoryByPlantChart";
import { StatusDonuts } from "@/components/charts/StatusDonuts";
import { TopCustomersChart } from "@/components/charts/TopCustomersChart";

const TYPE_STYLE: Record<string, string> = {
  FERT: "bg-sky-500/15 text-sky-300",
  HALB: "bg-violet-500/15 text-violet-300",
  ROH: "bg-amber-500/15 text-amber-300",
};

const materialColumns: Column<MaterialRevRow>[] = [
  { key: "material_no", header: "Material", className: "text-slate-400" },
  { key: "description", header: "Description", render: (r) => <span className="text-slate-200">{r.description}</span> },
  {
    key: "type",
    header: "Type",
    render: (r) => (
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_STYLE[r.type] ?? "bg-slate-700 text-slate-300"}`}>
        {r.type}
      </span>
    ),
  },
  { key: "qty", header: "Qty sold", align: "right", render: (r) => formatNumber(r.qty) },
  { key: "revenue_eur", header: "Revenue", align: "right", render: (r) => <span className="font-medium text-slate-100">{formatInr(r.revenue_eur)}</span> },
];

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsyncData(getDashboard);

  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2"><Panel title="Monthly sales trend"><ChartSkeleton /></Panel></div>
          <Panel title="Order status"><ChartSkeleton /></Panel>
        </div>
      </div>
    );
  }

  const { kpis } = data;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Inventory Value" value={formatInr(kpis.inventory_value_eur)} sub="across 4 plants" accent="text-sky-300" />
        <KpiCard
          label="Open Sales Orders"
          value={formatNumber(kpis.open_sales_orders.count)}
          sub={formatInr(kpis.open_sales_orders.value_eur)}
        />
        <KpiCard
          label="Open Purchase Orders"
          value={formatNumber(kpis.open_purchase_orders.count)}
          sub={formatInr(kpis.open_purchase_orders.value_eur)}
        />
        <KpiCard label="Customers" value={formatNumber(kpis.customers)} sub="active accounts" />
        <KpiCard
          label="Low-Stock Materials"
          value={formatNumber(kpis.low_stock)}
          sub="below reorder point"
          accent={kpis.low_stock > 0 ? "text-amber-300" : "text-slate-100"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel title="Monthly sales trend" subtitle="Revenue by month (excludes cancelled)">
            <SalesTrendChart data={data.salesTrendByMonth} />
          </Panel>
        </div>
        <Panel title="Order status" subtitle="By document count">
          <StatusDonuts sales={data.salesByStatus} purchases={data.purchasesByStatus} />
        </Panel>

        <Panel title="Inventory value by plant">
          <InventoryByPlantChart data={data.inventoryByPlant} />
        </Panel>
        <div className="xl:col-span-2">
          <Panel title="Top customers by revenue">
            <TopCustomersChart data={data.topCustomers} />
          </Panel>
        </div>

        <div className="xl:col-span-3">
          <Panel title="Top materials by revenue">
            <DataTable columns={materialColumns} rows={data.topMaterials} rowKey={(r) => r.material_no} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
