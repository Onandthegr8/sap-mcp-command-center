// Smoke test for the synthetic data layer (Prompt 2).
// Seeds the DB, then runs every analytics helper and prints a sample of each.

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { generate } from '../src/data/generate.js';
import * as analytics from '../src/data/analytics.js';

function show(label, rows, n = 5) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 50 - label.length))}`);
  if (Array.isArray(rows)) {
    console.table(rows.slice(0, n));
    if (rows.length > n) console.log(`   … ${rows.length - n} more row(s)`);
  } else {
    console.dir(rows, { depth: null });
  }
}

export default function run() {
  console.log('Seeding synthetic SAP data…');
  const counts = generate();
  console.log('Row counts:', counts);

  show('salesTrendByMonth()', analytics.salesTrendByMonth(), 6);
  show('topCustomersByRevenue(5)', analytics.topCustomersByRevenue(5));
  show('topMaterialsByRevenue(5)', analytics.topMaterialsByRevenue(5));
  show('inventoryValueByPlant()', analytics.inventoryValueByPlant());
  show('openOrdersSummary()', analytics.openOrdersSummary());
  show('lowStockMaterials()', analytics.lowStockMaterials(), 5);
  show('salesByStatus()', analytics.salesByStatus());
  show('purchasesByStatus()', analytics.purchasesByStatus());
  show('inventoryValueTotal()', { inventory_value_eur: analytics.inventoryValueTotal() });
  show('entityCounts()', analytics.entityCounts());

  console.log('\n[data.smoke] OK\n');
}

if (resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url))) run();
