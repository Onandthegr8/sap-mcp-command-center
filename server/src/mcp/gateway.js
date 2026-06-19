// Config-driven MCP gateway.
//
// Reads systems.config.json and, for every system, registers ONE MCP tool per capability
// named `${system.id}_${capability}` (e.g. sap_erp_get_material, sap_bw_run_query). The tool's
// handler is the shared registry handler bound to that system. Adding a new system entry to the
// JSON registers its tools with ZERO code changes — see test/gateway.smoke.js for proof.
//
// Every invocation flows through callTool(), which times it, records telemetry, and returns the
// flat-JSON result. The MCP transport AND the REST bridge both call through here.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { capabilities } from './tools.js';
import { recordCall } from './telemetry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'systems.config.json');

const systems = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const lastPing = new Map(); // systemId -> most recent successful ping call entry

/** All configured systems (raw config entries). */
export function listSystems() {
  return systems;
}

/** Look up a system config by id. */
export function getSystem(id) {
  return systems.find((s) => s.id === id);
}

/** Every registered per-system tool name, derived purely from config. */
export function toolNames() {
  const names = [];
  for (const s of systems) {
    for (const c of s.capabilities) {
      if (capabilities[c]) names.push(`${s.id}_${c}`);
    }
  }
  return names;
}

/**
 * Invoke a capability on a system. Shared by the MCP transport and the REST bridge.
 * Times the call, records a telemetry entry, and returns { result, call }.
 */
export async function callTool(systemId, capability, args = {}) {
  const system = getSystem(systemId);
  const def = capabilities[capability];
  const tool = `${systemId}_${capability}`;
  const t0 = performance.now();

  let result;
  let status;
  try {
    if (!system) throw new Error(`Unknown system "${systemId}"`);
    if (!def) throw new Error(`Unknown capability "${capability}" for ${systemId}`);
    result = await def.handler(args ?? {}, system);
    status = result?.status ?? 'ok';
  } catch (e) {
    result = { status: 'error', error: e.message };
    status = 'error';
  }

  const ms = Math.round((performance.now() - t0) * 100) / 100;
  const call = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    tool,
    system: systemId,
    capability,
    args: args ?? {},
    ms,
    status,
  };
  recordCall(call);
  if (capability === 'ping' && status === 'ok') lastPing.set(systemId, call);
  return { result, call };
}

// Wrap a flat-JSON result in MCP content format.
function toMcp(result) {
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    ...(result?.status === 'error' ? { isError: true } : {}),
  };
}

/**
 * Build a fresh McpServer with all config-driven tools registered.
 * The SDK requires a new server instance per transport/connection, so this is a factory.
 */
export function createServer() {
  const server = new McpServer({ name: 'sap-mcp-command-center', version: '0.1.0' });

  // Global discovery tool.
  server.tool(
    'list_systems',
    'List the configured synthetic SAP systems, their layers, and the tools each exposes.',
    {},
    async () =>
      toMcp({
        status: 'ok',
        systems: systems.map((s) => ({
          id: s.id,
          label: s.label,
          layer: s.layer,
          tools: s.capabilities.filter((c) => capabilities[c]).map((c) => `${s.id}_${c}`),
        })),
      }),
  );

  // Per-system tools — registered dynamically from config.
  for (const system of systems) {
    for (const cap of system.capabilities) {
      const def = capabilities[cap];
      if (!def) continue; // capability declared in config but not implemented yet
      server.tool(
        `${system.id}_${cap}`,
        `[${system.label}] ${def.description}`,
        def.inputSchema,
        async (args) => {
          const { result } = await callTool(system.id, cap, args ?? {});
          return toMcp(result);
        },
      );
    }
  }

  return server;
}

/** Systems + their tools + a live ping — backs GET /api/systems. */
export function systemsView() {
  return systems.map((s) => ({
    id: s.id,
    label: s.label,
    layer: s.layer,
    capabilities: s.capabilities,
    tools: s.capabilities.filter((c) => capabilities[c]).map((c) => `${s.id}_${c}`),
    ping: capabilities.ping.handler({}, s),
    lastPing: lastPing.get(s.id) ?? null,
  }));
}
