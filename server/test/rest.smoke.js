// Smoke test for the REST bridge (Prompt 5).
// Boots the Express app on an ephemeral port, hits each endpoint with fetch, and verifies the
// SSE activity stream delivers a live event when an /api/ask triggers a tool call.

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { createApp } from '../src/index.js';

const snippet = (v, n = 160) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + '…' : s;
};

async function readUntil(reader, pred, timeoutMs) {
  const dec = new TextDecoder();
  let buf = '';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const to = new Promise((_, rej) => setTimeout(() => rej(new Error('stream timeout')), deadline - Date.now()));
    const { value, done } = await Promise.race([reader.read(), to]);
    if (done) break;
    buf += dec.decode(value, { stream: true });
    if (pred(buf)) return buf;
  }
  throw new Error('stream timeout');
}

export default async function run() {
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, () => r(s));
  });
  const base = `http://localhost:${server.address().port}`;
  const hit = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json() };
  };

  try {
    const systems = await hit('GET', '/api/systems');
    console.log(`GET  /api/systems      ${systems.status}  systems=${systems.json.systems.length}`);

    const dash = await hit('GET', '/api/dashboard');
    console.log(`GET  /api/dashboard    ${dash.status}  kpis=${snippet(dash.json.kpis)}`);
    console.log(`                            trend=${dash.json.salesTrendByMonth.length}mo, topCustomers=${dash.json.topCustomers.length}, inventoryByPlant=${dash.json.inventoryByPlant.length}`);

    const ask1 = await hit('POST', '/api/ask', { text: 'which materials are below reorder point?' });
    console.log(`POST /api/ask          ${ask1.status}  matched=${ask1.json.matched} tool=${ask1.json.tool} calls=${ask1.json.calls.length}`);
    console.log(`                            "${ask1.json.explanation}" -> ${snippet(ask1.json.result, 90)}`);

    const ask2 = await hit('POST', '/api/ask', { text: 'make me a sandwich' });
    console.log(`POST /api/ask (miss)   ${ask2.status}  matched=${ask2.json.matched} suggestions=${ask2.json.suggestions.length}`);

    const act = await hit('GET', '/api/activity');
    console.log(`GET  /api/activity     ${act.status}  recent calls=${act.json.calls.length}`);

    // SSE stream: subscribe, trigger a call, confirm it streams through.
    const ac = new AbortController();
    let streamedTool = null;
    try {
      const sres = await fetch(base + '/api/activity/stream', { signal: ac.signal });
      const reader = sres.body.getReader();
      await readUntil(reader, (b) => b.includes('event: hello'), 3000);
      await hit('POST', '/api/ask', { text: 'top 3 customers by revenue' });
      const got = await readUntil(reader, (b) => b.includes('"tool"'), 4000);
      streamedTool = (got.match(/"tool":"([^"]+)"/) || [])[1] ?? '(unknown)';
    } finally {
      ac.abort();
    }
    console.log(`GET  /api/activity/stream  200  live event received -> tool=${streamedTool}`);

    if (!ask1.json.matched || ask1.json.calls.length === 0) throw new Error('/api/ask did not dispatch a tool call');
    if (!streamedTool) throw new Error('SSE stream did not deliver a live tool-call event');

    console.log('\n[rest.smoke] OK');
  } finally {
    server.close();
  }
}

if (resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url))) run();
