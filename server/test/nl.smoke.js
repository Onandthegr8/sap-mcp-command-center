// Smoke test for the rule-based NL router (Prompt 4).
// Feeds a batch of utterances through ask() (route + dispatch) and prints the resolved
// tool, args, and a snippet of the result. Assumes the DB is seeded (suite seeds first).

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { route, ask } from '../src/nl/router.js';

const UTTERANCES = [
  'ping all systems',
  'are the systems up?',
  'show materials below reorder point',
  "what's low on stock in frankfurt",
  'list FERT materials in munich',
  'open sales orders',
  'sales orders for customer 0000001048',
  'open purchase orders',
  'purchase orders for vendor 0000100007',
  'top 5 customers by revenue',
  'top materials by revenue',
  'sales trend this year',
  'monthly sales',
  'inventory value by plant',
  'deliveries for order 4500000123',
  'material 10000042',
  'get customer 0000001048',
  'open orders',
  'tell me a joke', // unmatched -> suggestions
];

function resultSnippet(res) {
  if (!res) return '(no result)';
  if (Array.isArray(res?.rows)) return `rows=${res.row_count ?? res.rows.length}`;
  if (Array.isArray(res?.materials)) return `materials=${res.count}`;
  if (Array.isArray(res?.sales_orders)) return `sales_orders=${res.count}`;
  if (Array.isArray(res?.purchase_orders)) return `purchase_orders=${res.count}`;
  if (Array.isArray(res?.deliveries)) return `deliveries=${res.count}`;
  if (Array.isArray(res?.steps)) return `steps=${res.steps.length} (${res.steps.map((s) => s.status).join('/')})`;
  if (res?.material) return `material ${res.material.material_no} — ${res.material.description}`;
  if (res?.customer) return `customer ${res.customer.customer_no} — ${res.customer.name}`;
  const s = JSON.stringify(res);
  return s.length > 70 ? s.slice(0, 70) + '…' : s;
}

export default async function run() {
  console.log('Routing utterances through the NL router (no LLM):\n');
  const rows = [];
  for (const text of UTTERANCES) {
    const r = route(text);
    if (!r.matched) {
      rows.push({ utterance: text, tool: '— (no match)', args: '', result: `${r.suggestions.length} suggestions` });
      continue;
    }
    const a = await ask(text);
    const tool = r.plan.length > 1 ? `${r.plan.length}× ${r.plan.map((p) => p.tool).join(',')}` : r.tool;
    rows.push({
      utterance: text,
      tool,
      args: JSON.stringify(r.plan.length > 1 ? {} : r.args),
      result: resultSnippet(a.result),
    });
  }
  console.table(rows);

  const matched = rows.filter((r) => !r.tool.includes('no match')).length;
  console.log(`\nMatched ${matched}/${UTTERANCES.length} (1 intentionally unmatched).`);
  console.log('[nl.smoke] OK');
}

if (resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url))) run();
