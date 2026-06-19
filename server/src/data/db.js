// SQLite access layer (better-sqlite3).
// Opens/creates server/data.db, defines the schema, and exposes a shared connection.
// NOTE: default rollback journal (not WAL) — the project lives under OneDrive and WAL's
// persistent -wal/-shm files don't play nicely with file-sync. The DB is seeded once and
// then read-mostly, so default journaling is plenty.

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the synthetic database file (server/data.db). */
export const DB_PATH = join(__dirname, '..', '..', 'data.db');

// Drop order respects foreign keys (children before parents).
const TABLES = [
  'deliveries',
  'purchase_order_items',
  'purchase_orders',
  'sales_order_items',
  'sales_orders',
  'materials',
  'customers',
  'vendors',
  'plants',
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS plants (
  id       TEXT PRIMARY KEY,            -- '1000'
  name     TEXT NOT NULL,               -- 'Hamburg'
  country  TEXT NOT NULL                -- 'DE'
);

CREATE TABLE IF NOT EXISTS materials (
  material_no    TEXT PRIMARY KEY,      -- 8-digit-ish, e.g. '10000042'
  description    TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('FERT','HALB','ROH')),
  plant_id       TEXT NOT NULL REFERENCES plants(id),
  base_unit      TEXT NOT NULL,         -- ST / KG / L / M / PC
  std_price_eur  REAL NOT NULL,
  stock_qty      INTEGER NOT NULL,
  reorder_point  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  customer_no       TEXT PRIMARY KEY,   -- 10-digit, e.g. '0000001234'
  name              TEXT NOT NULL,
  country           TEXT NOT NULL,
  city              TEXT NOT NULL,
  credit_limit_eur  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS vendors (
  vendor_no  TEXT PRIMARY KEY,          -- 10-digit, e.g. '0000100007'
  name       TEXT NOT NULL,
  country    TEXT NOT NULL,
  city       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_orders (
  so_no          TEXT PRIMARY KEY,      -- 10-digit, e.g. '4500000123'
  customer_no    TEXT NOT NULL REFERENCES customers(customer_no),
  created_at     TEXT NOT NULL,         -- ISO datetime
  status         TEXT NOT NULL CHECK (status IN ('OPEN','DELIVERED','INVOICED','CANCELLED')),
  net_value_eur  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  so_no          TEXT NOT NULL REFERENCES sales_orders(so_no),
  item_no        INTEGER NOT NULL,      -- 10, 20, 30 ...
  material_no    TEXT NOT NULL REFERENCES materials(material_no),
  qty            INTEGER NOT NULL,
  net_value_eur  REAL NOT NULL,
  PRIMARY KEY (so_no, item_no)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  po_no          TEXT PRIMARY KEY,      -- 10-digit, e.g. '4700000045'
  vendor_no      TEXT NOT NULL REFERENCES vendors(vendor_no),
  created_at     TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('OPEN','RECEIVED','INVOICED','CANCELLED')),
  net_value_eur  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  po_no          TEXT NOT NULL REFERENCES purchase_orders(po_no),
  item_no        INTEGER NOT NULL,
  material_no    TEXT NOT NULL REFERENCES materials(material_no),
  qty            INTEGER NOT NULL,
  net_value_eur  REAL NOT NULL,
  PRIMARY KEY (po_no, item_no)
);

CREATE TABLE IF NOT EXISTS deliveries (
  delivery_no    TEXT PRIMARY KEY,      -- 10-digit, e.g. '8000000031'
  so_no          TEXT NOT NULL REFERENCES sales_orders(so_no),
  delivery_date  TEXT NOT NULL,
  status         TEXT NOT NULL          -- OPEN / IN_TRANSIT / DELIVERED
);

CREATE INDEX IF NOT EXISTS idx_materials_plant   ON materials(plant_id, type);
CREATE INDEX IF NOT EXISTS idx_so_created        ON sales_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_so_cust_status    ON sales_orders(customer_no, status);
CREATE INDEX IF NOT EXISTS idx_po_created        ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_po_vendor_status  ON purchase_orders(vendor_no, status);
CREATE INDEX IF NOT EXISTS idx_soi_material      ON sales_order_items(material_no);
CREATE INDEX IF NOT EXISTS idx_deliveries_so     ON deliveries(so_no);
`;

let _db;

/** Return the shared better-sqlite3 connection (opened lazily). */
export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('foreign_keys = ON');
    _db.pragma('busy_timeout = 5000');
  }
  return _db;
}

/** Wipe every table then recreate the schema — used by the seeder. */
export function resetSchema(db = getDb()) {
  for (const table of TABLES) db.exec(`DROP TABLE IF EXISTS ${table};`);
  db.exec(SCHEMA);
}

/** Row counts per table (used by the seeder + smoke test). */
export function rowCounts(db = getDb()) {
  const counts = {};
  for (const table of [...TABLES].reverse()) {
    counts[table] = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  }
  return counts;
}
