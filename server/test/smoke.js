// Aggregate smoke-test runner — runs each backend stage's smoke test in order.
// `npm run smoke` from the repo root runs this. Stages seed first, then exercise
// the gateway / NL router / REST bridge built on top of the seeded data.

import dataSmoke from './data.smoke.js';
import gatewaySmoke from './gateway.smoke.js';
import nlSmoke from './nl.smoke.js';
import restSmoke from './rest.smoke.js';

const STAGES = [
  ['data layer', dataSmoke],
  ['mcp gateway', gatewaySmoke],
  ['nl router', nlSmoke],
  ['rest bridge', restSmoke],
];

console.log('╔══════════════════════════════════════════════╗');
console.log('║  sap-mcp-command-center — smoke suite          ║');
console.log('╚══════════════════════════════════════════════╝');

for (const [name, fn] of STAGES) {
  console.log(`\n### Stage: ${name}\n`);
  await fn();
}

console.log('\nAll smoke stages passed ✓\n');
