// Typed API client for the REST bridge (server :3041). Override the base with
// NEXT_PUBLIC_API_BASE if the server runs elsewhere.
// Note: 127.0.0.1 (not "localhost") avoids the Windows IPv6 ::1-vs-127.0.0.1 ambiguity.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:3041";

// ── Shared types ────────────────────────────────────────────────────────────

export interface CountValue {
  count: number;
  value_eur: number;
}

export interface Kpis {
  inventory_value_eur: number;
  open_sales_orders: CountValue;
  open_purchase_orders: CountValue;
  customers: number;
  low_stock: number;
}

export interface TrendPoint {
  month: string;
  orders: number;
  revenue_eur: number;
}

export interface CustomerRow {
  customer_no: string;
  name: string;
  country: string;
  orders: number;
  revenue_eur: number;
}

export interface MaterialRevRow {
  material_no: string;
  description: string;
  type: string;
  qty: number;
  revenue_eur: number;
}

export interface PlantInventory {
  plant_id: string;
  plant_name: string;
  materials: number;
  inventory_value_eur: number;
}

export interface StatusRow {
  status: string;
  count: number;
  value_eur: number;
}

export interface Dashboard {
  status: string;
  kpis: Kpis;
  salesTrendByMonth: TrendPoint[];
  topCustomers: CustomerRow[];
  topMaterials: MaterialRevRow[];
  inventoryByPlant: PlantInventory[];
  salesByStatus: StatusRow[];
  purchasesByStatus: StatusRow[];
}

export interface SystemView {
  id: string;
  label: string;
  layer: string;
  capabilities: string[];
  tools: string[];
  ping: { status: string; ts: string; [k: string]: unknown };
  lastPing: unknown | null;
}

export interface ToolCall {
  id: string;
  ts: string;
  tool: string;
  system: string;
  capability: string;
  args: Record<string, unknown>;
  ms: number;
  status: string;
}

export interface AskResponse {
  matched: boolean;
  system?: string;
  tool?: string;
  args?: Record<string, unknown>;
  explanation: string;
  result?: unknown;
  calls: ToolCall[];
  suggestions?: string[];
}

// ── Fetchers ────────────────────────────────────────────────────────────────

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const getDashboard = () => getJson<Dashboard>("/api/dashboard");
export const getSystems = () => getJson<{ status: string; systems: SystemView[] }>("/api/systems");
export const getActivity = () => getJson<{ status: string; calls: ToolCall[] }>("/api/activity");

export async function ask(text: string): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`/api/ask → HTTP ${res.status}`);
  return res.json() as Promise<AskResponse>;
}

export const activityStreamUrl = () => `${API_BASE}/api/activity/stream`;
