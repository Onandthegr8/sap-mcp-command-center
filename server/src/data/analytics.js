// BW/BICS-style aggregation helpers. Each returns flat rows (or a small flat object),
// mirroring how a BEx query hands back a result table. Pure reads over the SQLite layer.

import { getDb } from './db.js';

const db = () => getDb();

/** Monthly sales revenue + order count (excludes cancelled). */
export function salesTrendByMonth() {
  return db().prepare(`
    SELECT strftime('%Y-%m', created_at) AS month,
           COUNT(*)                      AS orders,
           ROUND(SUM(net_value_eur), 2)  AS revenue_eur
    FROM sales_orders
    WHERE status != 'CANCELLED'
    GROUP BY month
    ORDER BY month
  `).all();
}

/** Customers ranked by total non-cancelled sales revenue. */
export function topCustomersByRevenue(limit = 5) {
  return db().prepare(`
    SELECT c.customer_no,
           c.name,
           c.country,
           COUNT(o.so_no)               AS orders,
           ROUND(SUM(o.net_value_eur), 2) AS revenue_eur
    FROM sales_orders o
    JOIN customers c ON c.customer_no = o.customer_no
    WHERE o.status != 'CANCELLED'
    GROUP BY c.customer_no
    ORDER BY revenue_eur DESC
    LIMIT ?
  `).all(limit);
}

/** Materials ranked by total sold value (excludes cancelled orders). */
export function topMaterialsByRevenue(limit = 5) {
  return db().prepare(`
    SELECT m.material_no,
           m.description,
           m.type,
           SUM(i.qty)                     AS qty,
           ROUND(SUM(i.net_value_eur), 2) AS revenue_eur
    FROM sales_order_items i
    JOIN materials m    ON m.material_no = i.material_no
    JOIN sales_orders o ON o.so_no       = i.so_no
    WHERE o.status != 'CANCELLED'
    GROUP BY m.material_no
    ORDER BY revenue_eur DESC
    LIMIT ?
  `).all(limit);
}

/** Stock value (std price × qty on hand) per plant. */
export function inventoryValueByPlant() {
  return db().prepare(`
    SELECT p.id                                      AS plant_id,
           p.name                                    AS plant_name,
           COUNT(m.material_no)                      AS materials,
           ROUND(SUM(m.std_price_eur * m.stock_qty), 2) AS inventory_value_eur
    FROM plants p
    LEFT JOIN materials m ON m.plant_id = p.id
    GROUP BY p.id
    ORDER BY inventory_value_eur DESC
  `).all();
}

/** Counts + EUR value of OPEN sales orders and OPEN purchase orders. */
export function openOrdersSummary() {
  const so = db().prepare(
    `SELECT COUNT(*) AS count, ROUND(COALESCE(SUM(net_value_eur), 0), 2) AS value_eur
     FROM sales_orders WHERE status = 'OPEN'`,
  ).get();
  const po = db().prepare(
    `SELECT COUNT(*) AS count, ROUND(COALESCE(SUM(net_value_eur), 0), 2) AS value_eur
     FROM purchase_orders WHERE status = 'OPEN'`,
  ).get();
  return { open_sales_orders: so, open_purchase_orders: po };
}

/** Materials whose stock has fallen below their reorder point. */
export function lowStockMaterials() {
  return db().prepare(`
    SELECT m.material_no,
           m.description,
           m.type,
           m.plant_id,
           p.name AS plant_name,
           m.base_unit,
           m.stock_qty,
           m.reorder_point,
           (m.reorder_point - m.stock_qty) AS shortfall
    FROM materials m
    JOIN plants p ON p.id = m.plant_id
    WHERE m.stock_qty < m.reorder_point
    ORDER BY shortfall DESC
  `).all();
}

// ── Extras used by the dashboard / BW run_query (still flat shapes) ─────────

/** Sales order count + value grouped by status (for status breakdown charts). */
export function salesByStatus() {
  return db().prepare(`
    SELECT status, COUNT(*) AS count, ROUND(SUM(net_value_eur), 2) AS value_eur
    FROM sales_orders GROUP BY status ORDER BY status
  `).all();
}

/** Purchase order count + value grouped by status. */
export function purchasesByStatus() {
  return db().prepare(`
    SELECT status, COUNT(*) AS count, ROUND(SUM(net_value_eur), 2) AS value_eur
    FROM purchase_orders GROUP BY status ORDER BY status
  `).all();
}

/** Total stock value across all plants. */
export function inventoryValueTotal() {
  return db().prepare(
    `SELECT ROUND(SUM(std_price_eur * stock_qty), 2) AS inventory_value_eur FROM materials`,
  ).get().inventory_value_eur ?? 0;
}

/** Headline counts for KPI cards. */
export function entityCounts() {
  const one = (sql) => db().prepare(sql).get().n;
  return {
    customers: one('SELECT COUNT(*) AS n FROM customers'),
    vendors: one('SELECT COUNT(*) AS n FROM vendors'),
    materials: one('SELECT COUNT(*) AS n FROM materials'),
    plants: one('SELECT COUNT(*) AS n FROM plants'),
    low_stock: one('SELECT COUNT(*) AS n FROM materials WHERE stock_qty < reorder_point'),
  };
}
