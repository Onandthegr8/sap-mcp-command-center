// Entry point: Express app hosting the MCP SSE gateway + the REST bridge for the web app.
//   GET /sse, POST /messages          -> MCP SSE transport (connectable from Claude Desktop)
//   GET /health                       -> quick status
//   GET /api/systems                  -> systems config + live ping status
//   GET /api/dashboard                -> dashboard payload
//   POST /api/ask                     -> NL router -> tool dispatch
//   GET /api/activity[/stream]        -> tool-call telemetry (poll + SSE)

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { mountSse } from './mcp/transport.js';
import { mountRest } from './rest.js';
import { listSystems, toolNames } from './mcp/gateway.js';
import { getDb } from './data/db.js';
import { generate } from './data/generate.js';

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = parseInt(process.env.PORT ?? '3041', 10);

/** Seed the database on first run so `npm run dev` works even without an explicit `npm run seed`. */
function ensureSeeded() {
  try {
    if (getDb().prepare('SELECT COUNT(*) AS n FROM plants').get().n > 0) return;
  } catch {
    /* table doesn't exist yet */
  }
  console.log('[seed] empty database detected — generating synthetic data…');
  generate();
}

/** Build the Express app (no listen) — used by the server entry point and the REST smoke test. */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // MCP SSE transport.
  const transports = mountSse(app);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      server: 'sap-mcp-command-center',
      tools: toolNames().length,
      activeSessions: transports.size,
      uptime: process.uptime(),
      ts: new Date().toISOString(),
    });
  });

  // REST bridge (/api/*).
  mountRest(app);

  return app;
}

/** Start listening. */
export function start(port = PORT, host = HOST) {
  ensureSeeded();
  const app = createApp();
  return app.listen(port, host, () => {
    const h = host === '0.0.0.0' ? 'localhost' : host;
    console.log('');
    console.log('  SAP MCP Command Center — gateway + REST bridge');
    console.log(`  MCP SSE     : http://${h}:${port}/sse`);
    console.log(`  Health      : http://${h}:${port}/health`);
    console.log(`  REST API    : http://${h}:${port}/api/{systems,dashboard,ask,activity,activity/stream}`);
    console.log(`  Tools       : ${toolNames().length} across ${listSystems().length} systems (+ list_systems)`);
    console.log('');
  });
}

// Start only when run directly (node src/index.js), not when imported by the smoke test.
if (resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url))) start();
