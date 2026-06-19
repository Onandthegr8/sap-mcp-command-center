// Smoke test for the config-driven MCP gateway (Prompt 3).
// Lists every registered tool name (proving config-driven registration) and exercises
// one tool from each layer. Assumes the DB is already seeded (the suite seeds first).

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { toolNames, callTool, listSystems } from '../src/mcp/gateway.js';

const snippet = (v, n = 220) => {
  const s = JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + '…' : s;
};

export default async function run() {
  const names = toolNames();
  console.log(`Registered ${names.length} per-system tools (+ global list_systems), all derived from systems.config.json:\n`);
  for (const s of listSystems()) {
    const tools = s.capabilities.map((c) => `${s.id}_${c}`).join(', ');
    console.log(`  [${s.id}] ${s.label} (${s.layer})`);
    console.log(`     ${tools}`);
  }
  console.log(
    '\n  -> Adding a 4th system to systems.config.json would register its tools here with zero code changes.\n',
  );

  const probes = [
    ['sap_erp', 'ping', {}],
    ['sap_erp', 'list_materials', { type: 'FERT', below_reorder: true, limit: 3 }],
    ['sap_s4', 'get_sales_orders', { status: 'OPEN', limit: 3 }],
    ['sap_bw', 'run_query', { query_id: 'top_customers', params: { limit: 3 } }],
  ];

  for (const [sys, cap, args] of probes) {
    const { result, call } = await callTool(sys, cap, args);
    console.log(`${call.tool}(${JSON.stringify(args)})  ->  ${call.status} in ${call.ms}ms`);
    console.log(`   ${snippet(result)}\n`);
    if (call.status !== 'ok') throw new Error(`Tool ${call.tool} returned status=${call.status}`);
  }

  console.log('[gateway.smoke] OK');
}

if (resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url))) run();
