// SSE transport wiring, per the MCP SDK's SSEServerTransport pattern.
//   GET  /sse                      -> open an event stream (one fresh McpServer per client)
//   POST /messages?sessionId=...   -> deliver a client->server message to that session
// Active transports are kept in a UUID-keyed map so multiple clients can connect at once.

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from './gateway.js';

export function mountSse(app) {
  const transports = new Map();

  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports.set(transport.sessionId, transport);
    console.log(`[sse] client connected: ${transport.sessionId} (${transports.size} active)`);

    res.on('close', () => {
      transports.delete(transport.sessionId);
      console.log(`[sse] client disconnected: ${transport.sessionId} (${transports.size} active)`);
    });

    const server = createServer();
    await server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = String(req.query.sessionId ?? '');
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(400).json({ error: `No active SSE session for sessionId "${sessionId}"` });
      return;
    }
    await transport.handlePostMessage(req, res, req.body);
  });

  return transports;
}
