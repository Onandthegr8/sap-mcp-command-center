// Deterministic plain-English -> tool-call router. NO LLM, NO API key. Pure rules.
//
// route(text)  -> { matched, system, capability, tool, args, explanation, plan, suggestions }
//   `plan` is an array of {system, capability, tool, args} — usually one step, but a few
//   intents (e.g. "ping all systems") fan out to several.
// ask(text)    -> resolves via route() then dispatches each step through the SAME gateway
//   handlers (callTool), so every routed request shows up in the live activity feed.

import { callTool } from '../mcp/gateway.js';

// ── Entity extractors ───────────────────────────────────────────────────────

const PLANTS = {
  hamburg: { id: '1000', name: 'Hamburg' },
  frankfurt: { id: '2000', name: 'Frankfurt' },
  munich: { id: '3000', name: 'Munich' },
  münchen: { id: '3000', name: 'Munich' },
  muenchen: { id: '3000', name: 'Munich' },
  berlin: { id: '4000', name: 'Berlin' },
};
const PLANT_BY_CODE = { 1000: 'Hamburg', 2000: 'Frankfurt', 3000: 'Munich', 4000: 'Berlin' };

function extractPlant(t) {
  for (const [name, p] of Object.entries(PLANTS)) {
    if (t.includes(name)) return p;
  }
  const m = t.match(/\bplant\s*(1000|2000|3000|4000)\b/) || t.match(/\b(1000|2000|3000|4000)\b/);
  if (m) return { id: m[1], name: PLANT_BY_CODE[m[1]] };
  return null;
}

function extractType(t) {
  if (/\bfert\b/.test(t) || /\bfinished\s+goods?\b/.test(t)) return 'FERT';
  if (/\bhalb\b/.test(t) || /\bsemi[-\s]?finished\b/.test(t)) return 'HALB';
  if (/\broh\b/.test(t) || /\braw\s+materials?\b/.test(t)) return 'ROH';
  return null;
}

function extractLimit(t, def = 5) {
  const m =
    t.match(/\btop\s+(\d{1,3})\b/) ||
    t.match(/\bfirst\s+(\d{1,3})\b/) ||
    t.match(/\b(\d{1,3})\s+(?:customers|materials|products)\b/);
  return m ? Math.min(100, parseInt(m[1], 10)) : def;
}

const fmtDate = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

function extractSince(t, now = new Date()) {
  let m;
  if ((m = t.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/)))
    return fmtDate(new Date(Date.now() - parseInt(m[1], 10) * 86_400_000));
  if ((m = t.match(/\b(?:last|past)\s+(\d{1,2})\s+months?\b/)))
    return fmtDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - parseInt(m[1], 10), now.getUTCDate())));
  if (/\b(this\s+year|year[-\s]to[-\s]date|ytd)\b/.test(t)) return fmtDate(new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
  if (/\blast\s+year\b/.test(t)) return fmtDate(new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)));
  if (/\bthis\s+quarter\b/.test(t)) return fmtDate(new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1)));
  if (/\blast\s+quarter\b/.test(t)) return fmtDate(new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3 - 3, 1)));
  if (/\bthis\s+month\b/.test(t)) return fmtDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  if (/\blast\s+month\b/.test(t)) return fmtDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  if (/\b(this\s+week|past\s+week|last\s+week)\b/.test(t)) return fmtDate(new Date(Date.now() - 7 * 86_400_000));
  if (/\b(recent|recently|lately)\b/.test(t)) return fmtDate(new Date(Date.now() - 30 * 86_400_000));
  return null;
}

function extractSalesStatus(t) {
  if (/\bcancel(?:l)?ed\b/.test(t)) return 'CANCELLED';
  if (/\bdelivered\b/.test(t)) return 'DELIVERED';
  if (/\binvoiced\b/.test(t)) return 'INVOICED';
  if (/\bopen\b/.test(t)) return 'OPEN';
  return null;
}

function extractPurchaseStatus(t) {
  if (/\bcancel(?:l)?ed\b/.test(t)) return 'CANCELLED';
  if (/\breceived\b/.test(t)) return 'RECEIVED';
  if (/\binvoiced\b/.test(t)) return 'INVOICED';
  if (/\b(open|overdue|outstanding)\b/.test(t)) return 'OPEN'; // overdue/outstanding -> open
  return null;
}

function extractEntities(t) {
  return {
    plant: extractPlant(t),
    type: extractType(t),
    limit: extractLimit(t),
    since: extractSince(t),
    materialNo: (t.match(/\b(\d{8})\b/) || [])[1] || null,
    account: (t.match(/\b(0\d{9})\b/) || [])[1] || null, // customer/vendor (0-prefixed 10-digit)
    soNo: (t.match(/\b(45\d{8})\b/) || [])[1] || null,
    poNo: (t.match(/\b(47\d{8})\b/) || [])[1] || null,
  };
}

// Helper to build a single-step result.
const one = (system, capability, args, explanation) => ({ explanation, calls: [{ system, capability, args }] });

// ── Ordered intent rules (first match wins) ─────────────────────────────────

const RULES = [
  // 1. ping / systems up
  {
    name: 'ping',
    test: (t) =>
      /\bping\b/.test(t) ||
      (/\bsystems?\b/.test(t) && /\b(up|online|alive|reachable|connected|status|healthy?|working)\b/.test(t)) ||
      /\bhealth\s?check\b/.test(t),
    build: (t) => {
      const targets = [];
      if (/\berp\b|master\s*data/.test(t)) targets.push(['sap_erp', 'SAP ERP']);
      if (/\bs\/?4\b|hana|transactional/.test(t)) targets.push(['sap_s4', 'SAP S/4HANA']);
      if (/\bbw\b|analytics|bex/.test(t)) targets.push(['sap_bw', 'SAP BW']);
      const all = targets.length === 0;
      const list = all ? [['sap_erp'], ['sap_s4'], ['sap_bw']] : targets;
      return {
        explanation: all ? 'Pinging all 3 systems' : `Pinging ${targets.map((x) => x[1]).join(', ')}`,
        calls: list.map(([system]) => ({ system, capability: 'ping', args: {} })),
      };
    },
  },

  // 2. low stock / below reorder
  {
    name: 'low_stock',
    test: (t) =>
      /\bbelow\s+reorder\b/.test(t) ||
      /\breorder\s+point\b/.test(t) ||
      /\blow[-\s]?stock\b/.test(t) ||
      /\blow\s+on\s+stock\b/.test(t) ||
      /\brunning\s+low\b/.test(t) ||
      /\b(what'?s|whats)\s+low\b/.test(t) ||
      /\b(under[-\s]?stocked|understocked)\b/.test(t) ||
      /\bneed(?:s)?\s+(?:reorder|restock)/.test(t),
    build: (t, e) => {
      const args = { below_reorder: true };
      if (e.plant) args.plant_id = e.plant.id;
      if (e.type) args.type = e.type;
      const where = `${e.type ? e.type + ' ' : ''}materials below reorder point${e.plant ? ' in ' + e.plant.name : ''}`;
      return one('sap_erp', 'list_materials', args, `Listing ${where}`);
    },
  },

  // 3. top customers by revenue
  {
    name: 'top_customers',
    test: (t) =>
      /\btop\s+\d*\s*customers\b/.test(t) ||
      /\bcustomers?\s+by\s+revenue\b/.test(t) ||
      /\b(best|biggest|highest|leading|largest)\s+customers\b/.test(t),
    build: (t, e) =>
      one('sap_bw', 'run_query', { query_id: 'top_customers', params: { limit: e.limit } }, `Top ${e.limit} customers by revenue`),
  },

  // 4. top materials / products by revenue
  {
    name: 'top_materials',
    test: (t) =>
      /\btop\s+\d*\s*(materials|products)\b/.test(t) ||
      /\b(materials|products)\s+by\s+revenue\b/.test(t) ||
      /\bbest[-\s]?selling\b/.test(t) ||
      /\b(best|biggest|highest|leading)\s+(materials|products)\b/.test(t),
    build: (t, e) =>
      one('sap_bw', 'run_query', { query_id: 'top_materials', params: { limit: e.limit } }, `Top ${e.limit} materials by revenue`),
  },

  // 5. sales trend
  {
    name: 'sales_trend',
    test: (t) =>
      /\bsales\s+trend\b/.test(t) ||
      /\bmonthly\s+sales\b/.test(t) ||
      /\brevenue\s+(by\s+month|over\s+time|trend)\b/.test(t) ||
      /\bsales\s+over\s+time\b/.test(t) ||
      (/\btrend\b/.test(t) && /\b(sales|revenue)\b/.test(t)),
    build: () => one('sap_bw', 'run_query', { query_id: 'sales_trend' }, 'Monthly sales trend (revenue by month)'),
  },

  // 6. inventory value by plant
  {
    name: 'inventory_by_plant',
    test: (t) =>
      /\binventory\s+value\b/.test(t) ||
      /\bstock\s+value\b/.test(t) ||
      (/\binventory\b/.test(t) && /\bplant\b/.test(t)),
    build: () => one('sap_bw', 'run_query', { query_id: 'inventory_by_plant' }, 'Inventory value by plant'),
  },

  // 7. deliveries
  {
    name: 'deliveries',
    test: (t) => /\bdeliver(?:y|ies)\b/.test(t),
    build: (t, e) => {
      const args = {};
      if (e.soNo) args.so_no = e.soNo;
      return one('sap_s4', 'get_deliveries', args, `Listing deliveries${e.soNo ? ' for sales order ' + e.soNo : ''}`);
    },
  },

  // 8. sales orders
  {
    name: 'sales_orders',
    test: (t) => /\bsales\s+orders?\b/.test(t) || (/\borders?\b/.test(t) && /\bsales\b/.test(t)),
    build: (t, e) => {
      const args = {};
      const status = extractSalesStatus(t);
      if (status) args.status = status;
      if (e.account) args.customer_no = e.account;
      if (e.since) args.since = e.since;
      const parts = [`Listing ${status ? status.toLowerCase() + ' ' : ''}sales orders`];
      if (e.account) parts.push(`for customer ${e.account}`);
      if (e.since) parts.push(`since ${e.since}`);
      return one('sap_s4', 'get_sales_orders', args, parts.join(' '));
    },
  },

  // 9. purchase orders
  {
    name: 'purchase_orders',
    test: (t) =>
      /\bpurchase\s+orders?\b/.test(t) ||
      /\bp\.?o\.?s?\b/.test(t) ||
      (/\borders?\b/.test(t) && /\b(purchase|procurement|vendor|supplier)\b/.test(t)) ||
      /\boverdue\s+purchase/.test(t),
    build: (t, e) => {
      const args = {};
      const status = extractPurchaseStatus(t);
      if (status) args.status = status;
      if (e.account) args.vendor_no = e.account;
      if (e.since) args.since = e.since;
      const parts = [`Listing ${status ? status.toLowerCase() + ' ' : ''}purchase orders`];
      if (e.account) parts.push(`for vendor ${e.account}`);
      if (e.since) parts.push(`since ${e.since}`);
      return one('sap_s4', 'get_purchase_orders', args, parts.join(' '));
    },
  },

  // 10. open orders summary (generic — neither "sales" nor "purchase" specified)
  {
    name: 'open_orders',
    test: (t) => /\bopen\s+orders?\b/.test(t) || /\borders?\s+summary\b/.test(t) || /\boutstanding\s+orders?\b/.test(t),
    build: () => one('sap_bw', 'run_query', { query_id: 'open_orders' }, 'Open orders summary (sales + purchase)'),
  },

  // 11. get material by number
  {
    name: 'get_material',
    test: (t, e) => /\bmaterial\b/.test(t) && !!e.materialNo,
    build: (t, e) => one('sap_erp', 'get_material', { material_no: e.materialNo }, `Fetching material ${e.materialNo}`),
  },

  // 12. list materials by type / plant
  {
    name: 'list_materials',
    test: (t, e) => /\bmaterials?\b/.test(t) && (!!e.type || !!e.plant || /\b(list|show|all|which|find)\b/.test(t)),
    build: (t, e) => {
      const args = {};
      if (e.plant) args.plant_id = e.plant.id;
      if (e.type) args.type = e.type;
      return one(
        'sap_erp',
        'list_materials',
        args,
        `Listing ${e.type ? e.type + ' ' : ''}materials${e.plant ? ' in ' + e.plant.name : ''}`,
      );
    },
  },

  // 13. get customer by number
  {
    name: 'get_customer',
    test: (t, e) => /\bcustomer\b/.test(t) && !!e.account,
    build: (t, e) => one('sap_erp', 'get_customer', { customer_no: e.account }, `Fetching customer ${e.account}`),
  },

  // 14. get vendor by number
  {
    name: 'get_vendor',
    test: (t, e) => /\b(vendor|supplier)\b/.test(t) && !!e.account,
    build: (t, e) => one('sap_erp', 'get_vendor', { vendor_no: e.account }, `Fetching vendor ${e.account}`),
  },

  // 15. list plants
  {
    name: 'list_plants',
    test: (t) => /\bplants?\b/.test(t) && /\b(list|show|all|which|how\s+many)\b/.test(t),
    build: () => one('sap_erp', 'list_plants', {}, 'Listing all plants'),
  },
];

const SUGGESTIONS = [
  'Which materials are below reorder point?',
  'Top 5 customers by revenue',
  'Show open sales orders',
  'Open purchase orders',
  'Sales trend this year',
  'Inventory value by plant',
  'Ping all systems',
];

function noMatch() {
  return {
    matched: false,
    system: null,
    capability: null,
    tool: null,
    args: {},
    explanation: "Sorry, I couldn't map that to a tool. Try one of these:",
    plan: [],
    suggestions: SUGGESTIONS,
  };
}

/** Resolve plain English to a tool-call plan. Pure — does not dispatch. */
export function route(text) {
  const t = String(text ?? '').toLowerCase().trim();
  if (!t) return noMatch();
  const e = extractEntities(t);

  for (const rule of RULES) {
    if (rule.test(t, e)) {
      const built = rule.build(t, e);
      const plan = built.calls.map((c) => ({ ...c, tool: `${c.system}_${c.capability}` }));
      return {
        matched: true,
        explanation: built.explanation,
        plan,
        system: plan[0].system,
        capability: plan[0].capability,
        tool: plan[0].tool,
        args: plan[0].args,
        rule: rule.name,
      };
    }
  }
  return noMatch();
}

/** Resolve via route() then dispatch every step through the gateway (shows in activity feed). */
export async function ask(text) {
  const r = route(text);
  if (!r.matched) return { ...r, result: null, results: [], calls: [] };

  const results = [];
  const calls = [];
  for (const step of r.plan) {
    const { result, call } = await callTool(step.system, step.capability, step.args);
    results.push(result);
    calls.push(call);
  }

  const result = r.plan.length === 1 ? results[0] : { status: 'ok', steps: results };
  return {
    matched: true,
    system: r.system,
    tool: r.tool,
    args: r.args,
    explanation: r.explanation,
    result,
    results,
    calls,
  };
}
