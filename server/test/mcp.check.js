// Manual check: connect to the running gateway over the REAL MCP SSE protocol
// (the same path Claude Desktop uses), list tools, and call one.
//
// Usage:  (1) npm run dev   — or — node src/index.js      (start the server)
//         (2) node test/mcp.check.js
// Optional: MCP_URL=http://host:port/sse node test/mcp.check.js

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const url = new URL(process.env.MCP_URL ?? 'http://127.0.0.1:3041/sse');

const transport = new SSEClientTransport(url);
const client = new Client({ name: 'mcp-check-client', version: '0.0.1' }, { capabilities: {} });

await client.connect(transport);
console.log(`Connected to MCP gateway at ${url.href}\n`);

const { tools } = await client.listTools();
console.log(`listTools() -> ${tools.length} tools:`);
console.log('  ' + tools.map((t) => t.name).join(', ') + '\n');

const res = await client.callTool({ name: 'sap_bw_run_query', arguments: { query_id: 'open_orders' } });
console.log('callTool sap_bw_run_query({query_id:"open_orders"}) ->');
console.log(res.content[0].text);

await client.close();
console.log('\n[mcp.check] OK — real MCP protocol round-trip succeeded.');
