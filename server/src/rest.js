// REST bridge for the web app. No new business logic — reuses the Prompt 3 gateway handlers
// (via the NL router's ask()) and the Prompt 2 analytics helpers. CORS is enabled globally
// in index.js for the Next.js dev origin.
//
//   GET  /api/systems          systems config + live ping status
//   GET  /api/dashboard        one payload for the whole dashboard
//   POST /api/ask {text}       NL router -> tool dispatch -> result + triggered tool-calls
//   GET  /api/activity         last 50 tool-call log entries
//   GET  /api/activity/stream  Server-Sent Events stream of new tool-call log entries

import { systemsView } from './mcp/gateway.js';
import { recentCalls, activity } from './mcp/telemetry.js';
import { ask } from './nl/router.js';
import {
  salesTrendByMonth,
  topCustomersByRevenue,
  topMaterialsByRevenue,
  inventoryValueByPlant,
  openOrdersSummary,
  inventoryValueTotal,
  entityCounts,
  salesByStatus,
  purchasesByStatus,
} from './data/analytics.js';

export function mountRest(app) {
  // Systems config + live ping.
  app.get('/api/systems', (_req, res) => {
    res.json({ status: 'ok', systems: systemsView() });
  });

  // One payload the dashboard can render directly.
  app.get('/api/dashboard', (_req, res) => {
    const open = openOrdersSummary();
    const counts = entityCounts();
    res.json({
      status: 'ok',
      kpis: {
        inventory_value_eur: inventoryValueTotal(),
        open_sales_orders: open.open_sales_orders, // { count, value_eur }
        open_purchase_orders: open.open_purchase_orders,
        customers: counts.customers,
        low_stock: counts.low_stock,
      },
      salesTrendByMonth: salesTrendByMonth(),
      topCustomers: topCustomersByRevenue(5),
      topMaterials: topMaterialsByRevenue(5),
      inventoryByPlant: inventoryValueByPlant(),
      openOrdersSummary: open,
      salesByStatus: salesByStatus(),
      purchasesByStatus: purchasesByStatus(),
    });
  });

  // Plain English -> tool call. Returns the routed tool + result + the tool-calls it triggered.
  app.post('/api/ask', async (req, res) => {
    const text = req.body?.text ?? '';
    const a = await ask(text);
    if (!a.matched) {
      res.json({ matched: false, explanation: a.explanation, suggestions: a.suggestions ?? [], calls: [] });
      return;
    }
    res.json({
      matched: true,
      system: a.system,
      tool: a.tool,
      args: a.args,
      explanation: a.explanation,
      result: a.result,
      calls: a.calls,
    });
  });

  // Recent tool-call log entries (newest first).
  app.get('/api/activity', (_req, res) => {
    res.json({ status: 'ok', calls: recentCalls(50) });
  });

  // Live stream of new tool-call log entries (Server-Sent Events).
  app.get('/api/activity/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.write(`event: hello\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);

    const onCall = (entry) => res.write(`data: ${JSON.stringify(entry)}\n\n`);
    activity.on('call', onCall);

    const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 25_000);

    req.on('close', () => {
      clearInterval(keepAlive);
      activity.off('call', onCall);
      res.end();
    });
  });
}
