// Deterministic synthetic-data generator (faker, fixed seed).
// Run with `npm run seed` (or `npm run reset`) to wipe + rebuild server/data.db.
//
// Determinism: a fixed faker seed makes every draw stable, so the demo numbers
// don't move between runs. Document dates are anchored to "now" so time-relative
// NL queries ("this year", "last 30 days") return data during a live demo — the
// *shape* of the trend stays stable, only the absolute calendar window slides.

import { faker } from '@faker-js/faker';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { getDb, resetSchema, rowCounts } from './db.js';

const SEED = 20240517;

const PLANTS = [
  { id: '1000', name: 'Hamburg', country: 'DE' },
  { id: '2000', name: 'Frankfurt', country: 'DE' },
  { id: '3000', name: 'Munich', country: 'DE' },
  { id: '4000', name: 'Berlin', country: 'DE' },
];

const BASE_UNITS = ['ST', 'KG', 'L', 'M', 'PC'];

// Per-calendar-month multiplier — gives the sales line a believable year-end peak.
const SEASONAL = {
  1: 0.85, 2: 0.8, 3: 0.95, 4: 1.0, 5: 1.05, 6: 1.1,
  7: 0.9, 8: 0.85, 9: 1.05, 10: 1.15, 11: 1.3, 12: 1.25,
};

const COUNTRY = [
  { weight: 6, value: 'DE' }, { weight: 1, value: 'AT' }, { weight: 1, value: 'CH' },
  { weight: 1, value: 'FR' }, { weight: 1, value: 'NL' }, { weight: 1, value: 'IT' },
];

const pad2 = (n) => String(n).padStart(2, '0');
const fmtDateTime = (d) =>
  `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ` +
  `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
const fmtDate = (d) =>
  `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const rand01 = () => faker.number.float({ min: 0, max: 1, fractionDigits: 4 });

// Build 18 month buckets (oldest -> current) with trend * seasonal weights.
function buildMonthBuckets(now) {
  const buckets = [];
  for (let i = 0; i < 18; i++) {
    const monthsBack = 17 - i;
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const isCurrent = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    buckets.push({
      year,
      month,
      weight: (1 + i * 0.05) * (SEASONAL[month] ?? 1), // mild upward trend + seasonality
      maxDay: isCurrent ? now.getUTCDate() : daysInMonth,
    });
  }
  return buckets;
}

function pickDate(buckets) {
  const b = faker.helpers.weightedArrayElement(
    buckets.map((x) => ({ weight: x.weight, value: x })),
  );
  return new Date(Date.UTC(
    b.year, b.month - 1,
    faker.number.int({ min: 1, max: Math.max(1, b.maxDay) }),
    faker.number.int({ min: 8, max: 18 }),
    faker.number.int({ min: 0, max: 59 }),
    faker.number.int({ min: 0, max: 59 }),
  ));
}

function salesStatus(ageDays) {
  if (rand01() < 0.05) return 'CANCELLED';
  if (ageDays < 30)
    return faker.helpers.weightedArrayElement([
      { weight: 7, value: 'OPEN' }, { weight: 3, value: 'DELIVERED' },
    ]);
  if (ageDays < 90)
    return faker.helpers.weightedArrayElement([
      { weight: 2, value: 'OPEN' }, { weight: 5, value: 'DELIVERED' }, { weight: 3, value: 'INVOICED' },
    ]);
  return faker.helpers.weightedArrayElement([
    { weight: 3, value: 'DELIVERED' }, { weight: 7, value: 'INVOICED' },
  ]);
}

function purchaseStatus(ageDays) {
  if (rand01() < 0.05) return 'CANCELLED';
  if (ageDays < 30)
    return faker.helpers.weightedArrayElement([
      { weight: 7, value: 'OPEN' }, { weight: 3, value: 'RECEIVED' },
    ]);
  if (ageDays < 90)
    return faker.helpers.weightedArrayElement([
      { weight: 2, value: 'OPEN' }, { weight: 5, value: 'RECEIVED' }, { weight: 3, value: 'INVOICED' },
    ]);
  return faker.helpers.weightedArrayElement([
    { weight: 3, value: 'RECEIVED' }, { weight: 7, value: 'INVOICED' },
  ]);
}

/** Wipe + rebuild the synthetic database. Returns row counts. */
export function generate() {
  faker.seed(SEED);
  const now = new Date();
  const buckets = buildMonthBuckets(now);

  // ── Materials ────────────────────────────────────────────────────────────
  const materials = [];
  for (let i = 0; i < 120; i++) {
    const stock_qty = faker.number.int({ min: 0, max: 1200 });
    const low = rand01() < 0.15;
    materials.push({
      material_no: String(10000000 + i), // 8-digit
      description: faker.commerce.productName(),
      type: faker.helpers.weightedArrayElement([
        { weight: 5, value: 'FERT' }, { weight: 3, value: 'HALB' }, { weight: 2, value: 'ROH' },
      ]),
      plant_id: faker.helpers.arrayElement(PLANTS).id,
      base_unit: faker.helpers.arrayElement(BASE_UNITS),
      std_price_eur: faker.number.float({ min: 5, max: 5000, fractionDigits: 2 }),
      stock_qty,
      reorder_point: low
        ? stock_qty + faker.number.int({ min: 20, max: 160 })           // below reorder
        : faker.number.int({ min: 0, max: Math.floor(stock_qty * 0.8) }), // healthy
    });
  }

  // ── Customers ──────────────────────────────────────────────────────────────
  const customers = [];
  for (let i = 0; i < 60; i++) {
    customers.push({
      customer_no: String(1000 + i).padStart(10, '0'), // 0000001000 ...
      name: faker.company.name(),
      country: faker.helpers.weightedArrayElement(COUNTRY),
      city: faker.location.city(),
      credit_limit_eur: faker.number.float({ min: 10000, max: 1000000, fractionDigits: 2 }),
    });
  }

  // ── Vendors ──────────────────────────────────────────────────────────────
  const vendors = [];
  for (let i = 0; i < 40; i++) {
    vendors.push({
      vendor_no: String(100000 + i).padStart(10, '0'), // 0000100000 ...
      name: faker.company.name(),
      country: faker.helpers.weightedArrayElement(COUNTRY),
      city: faker.location.city(),
    });
  }

  // ── Sales orders + items ─────────────────────────────────────────────────
  const salesOrders = [];
  const soItems = [];
  for (let i = 0; i < 400; i++) {
    const so_no = String(4500000000 + i);
    const created = pickDate(buckets);
    const ageDays = Math.floor((now - created) / 86_400_000);
    const nItems = faker.number.int({ min: 1, max: 5 });
    let net = 0;
    for (let j = 0; j < nItems; j++) {
      const mat = faker.helpers.arrayElement(materials);
      const qty = faker.number.int({ min: 1, max: 60 });
      const lineNet = +(qty * mat.std_price_eur * faker.number.float({ min: 0.9, max: 1.1, fractionDigits: 3 })).toFixed(2);
      net += lineNet;
      soItems.push({ so_no, item_no: (j + 1) * 10, material_no: mat.material_no, qty, net_value_eur: lineNet });
    }
    salesOrders.push({
      so_no,
      customer_no: faker.helpers.arrayElement(customers).customer_no,
      created_at: fmtDateTime(created),
      status: salesStatus(ageDays),
      net_value_eur: +net.toFixed(2),
    });
  }

  // ── Deliveries for a subset of shipped SOs ───────────────────────────────
  const deliveries = [];
  let delSeq = 0;
  for (const so of salesOrders) {
    const shipped = so.status === 'DELIVERED' || so.status === 'INVOICED';
    if (shipped && rand01() < 0.7) {
      const base = new Date(so.created_at.replace(' ', 'T') + 'Z');
      base.setUTCDate(base.getUTCDate() + faker.number.int({ min: 2, max: 12 }));
      deliveries.push({
        delivery_no: String(8000000000 + delSeq++),
        so_no: so.so_no,
        delivery_date: fmtDate(base),
        status: so.status === 'INVOICED'
          ? 'DELIVERED'
          : faker.helpers.weightedArrayElement([
              { weight: 6, value: 'DELIVERED' }, { weight: 3, value: 'IN_TRANSIT' }, { weight: 1, value: 'OPEN' },
            ]),
      });
    }
  }

  // ── Purchase orders + items ──────────────────────────────────────────────
  const purchaseOrders = [];
  const poItems = [];
  for (let i = 0; i < 250; i++) {
    const po_no = String(4700000000 + i);
    const created = pickDate(buckets);
    const ageDays = Math.floor((now - created) / 86_400_000);
    const nItems = faker.number.int({ min: 1, max: 4 });
    let net = 0;
    for (let j = 0; j < nItems; j++) {
      const mat = faker.helpers.arrayElement(materials);
      const qty = faker.number.int({ min: 5, max: 200 });
      // procurement price sits below sales price
      const lineNet = +(qty * mat.std_price_eur * faker.number.float({ min: 0.6, max: 0.95, fractionDigits: 3 })).toFixed(2);
      net += lineNet;
      poItems.push({ po_no, item_no: (j + 1) * 10, material_no: mat.material_no, qty, net_value_eur: lineNet });
    }
    purchaseOrders.push({
      po_no,
      vendor_no: faker.helpers.arrayElement(vendors).vendor_no,
      created_at: fmtDateTime(created),
      status: purchaseStatus(ageDays),
      net_value_eur: +net.toFixed(2),
    });
  }

  // ── Persist (parents before children, single transaction) ────────────────
  const db = getDb();
  resetSchema(db);

  const stmts = {
    plant: db.prepare('INSERT INTO plants (id,name,country) VALUES (?,?,?)'),
    material: db.prepare('INSERT INTO materials (material_no,description,type,plant_id,base_unit,std_price_eur,stock_qty,reorder_point) VALUES (?,?,?,?,?,?,?,?)'),
    customer: db.prepare('INSERT INTO customers (customer_no,name,country,city,credit_limit_eur) VALUES (?,?,?,?,?)'),
    vendor: db.prepare('INSERT INTO vendors (vendor_no,name,country,city) VALUES (?,?,?,?)'),
    so: db.prepare('INSERT INTO sales_orders (so_no,customer_no,created_at,status,net_value_eur) VALUES (?,?,?,?,?)'),
    soItem: db.prepare('INSERT INTO sales_order_items (so_no,item_no,material_no,qty,net_value_eur) VALUES (?,?,?,?,?)'),
    po: db.prepare('INSERT INTO purchase_orders (po_no,vendor_no,created_at,status,net_value_eur) VALUES (?,?,?,?,?)'),
    poItem: db.prepare('INSERT INTO purchase_order_items (po_no,item_no,material_no,qty,net_value_eur) VALUES (?,?,?,?,?)'),
    delivery: db.prepare('INSERT INTO deliveries (delivery_no,so_no,delivery_date,status) VALUES (?,?,?,?)'),
  };

  db.transaction(() => {
    for (const p of PLANTS) stmts.plant.run(p.id, p.name, p.country);
    for (const m of materials) stmts.material.run(m.material_no, m.description, m.type, m.plant_id, m.base_unit, m.std_price_eur, m.stock_qty, m.reorder_point);
    for (const c of customers) stmts.customer.run(c.customer_no, c.name, c.country, c.city, c.credit_limit_eur);
    for (const v of vendors) stmts.vendor.run(v.vendor_no, v.name, v.country, v.city);
    for (const so of salesOrders) stmts.so.run(so.so_no, so.customer_no, so.created_at, so.status, so.net_value_eur);
    for (const it of soItems) stmts.soItem.run(it.so_no, it.item_no, it.material_no, it.qty, it.net_value_eur);
    for (const po of purchaseOrders) stmts.po.run(po.po_no, po.vendor_no, po.created_at, po.status, po.net_value_eur);
    for (const it of poItems) stmts.poItem.run(it.po_no, it.item_no, it.material_no, it.qty, it.net_value_eur);
    for (const d of deliveries) stmts.delivery.run(d.delivery_no, d.so_no, d.delivery_date, d.status);
  })();

  return rowCounts(db);
}

// Run directly via `node src/data/generate.js` (npm run seed).
if (resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url))) {
  const t0 = Date.now();
  const counts = generate();
  console.log(`\n[seed] synthetic SAP data rebuilt in ${Date.now() - t0}ms (seed=${SEED})\n`);
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(22)} ${String(n).padStart(6)}`);
  }
  console.log('');
}
