// Capability registry: capability name -> { description, inputSchema, handler(args, system) }.
// The SAME handlers back both the MCP SSE transport and the REST bridge.
//
// `inputSchema` is a Zod raw shape (object of Zod validators). The MCP SDK consumes it
// directly and publishes it to clients as JSON Schema on the wire. Handlers always return
// flat JSON with a top-level `status` field ("ok"/"error") — echoing the BEx server contract.

import { z } from 'zod';
import { getDb } from '../data/db.js';
import {
  salesTrendByMonth,
  topCustomersByRevenue,
  topMaterialsByRevenue,
  inventoryValueByPlant,
  openOrdersSummary,
} from '../data/analytics.js';

const ok = (extra) => ({ status: 'ok', ...extra });
const err = (error, extra = {}) => ({ status: 'error', error, ...extra });

// ── BW (BEx-style) canned queries ──────────────────────────────────────────
export const BW_QUERIES = [
  { query_id: 'sales_trend',       name: 'Monthly Sales Trend',     description: 'Revenue and order count by calendar month.' },
  { query_id: 'top_customers',     name: 'Top Customers by Revenue', description: 'Highest-revenue customers.', params: { limit: 5 } },
  { query_id: 'top_materials',     name: 'Top Materials by Revenue', description: 'Highest-revenue materials.', params: { limit: 5 } },
  { query_id: 'inventory_by_plant', name: 'Inventory Value by Plant', description: 'Stock value per plant.' },
  { query_id: 'open_orders',       name: 'Open Orders Summary',      description: 'Open sales & purchase orders (count + value).' },
];

// Dispatch a BW query id to an analytics helper; always returns a flat row array.
function runQuery(query_id, params = {}) {
  switch (query_id) {
    case 'sales_trend':       return salesTrendByMonth();
    case 'top_customers':     return topCustomersByRevenue(params.limit ?? 5);
    case 'top_materials':     return topMaterialsByRevenue(params.limit ?? 5);
    case 'inventory_by_plant': return inventoryValueByPlant();
    case 'open_orders': {
      const s = openOrdersSummary();
      return [
        { metric: 'open_sales_orders', count: s.open_sales_orders.count, value_eur: s.open_sales_orders.value_eur },
        { metric: 'open_purchase_orders', count: s.open_purchase_orders.count, value_eur: s.open_purchase_orders.value_eur },
      ];
    }
    default: return null;
  }
}

export const capabilities = {
  // ── shared ────────────────────────────────────────────────────────────────
  ping: {
    description: 'Health check — confirm the system is reachable.',
    inputSchema: {},
    handler: (_args, system) =>
      ok({ system: system.id, label: system.label, layer: system.layer, ts: new Date().toISOString() }),
  },

  // ── sap_erp (master data) ──────────────────────────────────────────────────
  get_material: {
    description: 'Get one material master record by material number.',
    inputSchema: { material_no: z.string().describe('Material number, e.g. "10000042"') },
    handler: (args) => {
      const row = getDb()
        .prepare(`SELECT m.*, p.name AS plant_name FROM materials m JOIN plants p ON p.id = m.plant_id WHERE m.material_no = ?`)
        .get(String(args.material_no ?? '').trim());
      return row ? ok({ material: row }) : err(`Material ${args.material_no} not found`, { material_no: args.material_no });
    },
  },
  list_materials: {
    description: 'List materials, optionally filtered by plant, type, or below reorder point.',
    inputSchema: {
      plant_id: z.string().optional().describe('Plant code, e.g. "2000"'),
      type: z.enum(['FERT', 'HALB', 'ROH']).optional().describe('Material type'),
      below_reorder: z.boolean().optional().describe('Only materials with stock below their reorder point'),
      limit: z.number().int().min(1).max(500).optional(),
    },
    handler: (args) => {
      const where = [];
      const p = [];
      if (args.plant_id) { where.push('m.plant_id = ?'); p.push(String(args.plant_id)); }
      if (args.type) { where.push('m.type = ?'); p.push(String(args.type).toUpperCase()); }
      if (args.below_reorder) where.push('m.stock_qty < m.reorder_point');
      const sql =
        `SELECT m.material_no, m.description, m.type, m.plant_id, p.name AS plant_name,
                m.base_unit, m.std_price_eur, m.stock_qty, m.reorder_point
         FROM materials m JOIN plants p ON p.id = m.plant_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY m.material_no LIMIT ?`;
      const rows = getDb().prepare(sql).all(...p, args.limit ?? 200);
      return ok({ count: rows.length, materials: rows });
    },
  },
  get_customer: {
    description: 'Get one customer master record by customer number.',
    inputSchema: { customer_no: z.string().describe('Customer number, e.g. "0000001234"') },
    handler: (args) => {
      const row = getDb().prepare('SELECT * FROM customers WHERE customer_no = ?').get(String(args.customer_no ?? '').trim());
      return row ? ok({ customer: row }) : err(`Customer ${args.customer_no} not found`, { customer_no: args.customer_no });
    },
  },
  get_vendor: {
    description: 'Get one vendor master record by vendor number.',
    inputSchema: { vendor_no: z.string().describe('Vendor number, e.g. "0000100007"') },
    handler: (args) => {
      const row = getDb().prepare('SELECT * FROM vendors WHERE vendor_no = ?').get(String(args.vendor_no ?? '').trim());
      return row ? ok({ vendor: row }) : err(`Vendor ${args.vendor_no} not found`, { vendor_no: args.vendor_no });
    },
  },
  list_plants: {
    description: 'List all plants.',
    inputSchema: {},
    handler: () => {
      const rows = getDb().prepare('SELECT * FROM plants ORDER BY id').all();
      return ok({ count: rows.length, plants: rows });
    },
  },

  // ── sap_s4 (transactional) ─────────────────────────────────────────────────
  get_sales_orders: {
    description: 'List sales orders, optionally filtered by customer, status, or since-date.',
    inputSchema: {
      customer_no: z.string().optional(),
      status: z.enum(['OPEN', 'DELIVERED', 'INVOICED', 'CANCELLED']).optional(),
      since: z.string().optional().describe('ISO date lower bound, e.g. "2025-01-01"'),
      limit: z.number().int().min(1).max(500).optional(),
    },
    handler: (args) => {
      const where = [];
      const p = [];
      if (args.customer_no) { where.push('customer_no = ?'); p.push(String(args.customer_no)); }
      if (args.status) { where.push('status = ?'); p.push(String(args.status).toUpperCase()); }
      if (args.since) { where.push('created_at >= ?'); p.push(String(args.since)); }
      const sql = `SELECT * FROM sales_orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`;
      const rows = getDb().prepare(sql).all(...p, args.limit ?? 100);
      return ok({ count: rows.length, sales_orders: rows });
    },
  },
  get_purchase_orders: {
    description: 'List purchase orders, optionally filtered by vendor, status, or since-date.',
    inputSchema: {
      vendor_no: z.string().optional(),
      status: z.enum(['OPEN', 'RECEIVED', 'INVOICED', 'CANCELLED']).optional(),
      since: z.string().optional().describe('ISO date lower bound, e.g. "2025-01-01"'),
      limit: z.number().int().min(1).max(500).optional(),
    },
    handler: (args) => {
      const where = [];
      const p = [];
      if (args.vendor_no) { where.push('vendor_no = ?'); p.push(String(args.vendor_no)); }
      if (args.status) { where.push('status = ?'); p.push(String(args.status).toUpperCase()); }
      if (args.since) { where.push('created_at >= ?'); p.push(String(args.since)); }
      const sql = `SELECT * FROM purchase_orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`;
      const rows = getDb().prepare(sql).all(...p, args.limit ?? 100);
      return ok({ count: rows.length, purchase_orders: rows });
    },
  },
  get_deliveries: {
    description: 'List deliveries, optionally for a single sales order.',
    inputSchema: {
      so_no: z.string().optional().describe('Sales order number, e.g. "4500000123"'),
      limit: z.number().int().min(1).max(500).optional(),
    },
    handler: (args) => {
      const where = [];
      const p = [];
      if (args.so_no) { where.push('so_no = ?'); p.push(String(args.so_no)); }
      const sql = `SELECT * FROM deliveries ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY delivery_date DESC LIMIT ?`;
      const rows = getDb().prepare(sql).all(...p, args.limit ?? 100);
      return ok({ count: rows.length, deliveries: rows });
    },
  },

  // ── sap_bw (analytics) ─────────────────────────────────────────────────────
  list_queries: {
    description: 'List the available BW (BEx-style) analytics queries.',
    inputSchema: {},
    handler: () => ok({ count: BW_QUERIES.length, queries: BW_QUERIES }),
  },
  run_query: {
    description: 'Run a BW analytics query by id: sales_trend, top_customers, top_materials, inventory_by_plant, open_orders.',
    inputSchema: {
      query_id: z.string().describe('sales_trend | top_customers | top_materials | inventory_by_plant | open_orders'),
      params: z.object({ limit: z.number().int().min(1).max(100).optional() }).optional(),
    },
    handler: (args) => {
      const rows = runQuery(args.query_id, args.params ?? {});
      if (rows === null) return err(`Unknown query_id "${args.query_id}"`, { available: BW_QUERIES.map((q) => q.query_id) });
      return ok({ query_id: args.query_id, params: args.params ?? {}, row_count: rows.length, rows });
    },
  },
};
