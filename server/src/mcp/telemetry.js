// Tool-call telemetry: an in-memory ring buffer (last 100 calls) plus an event emitter.
// Both the MCP SSE transport and the REST bridge route their calls through here, so the
// web UI's live activity feed shows every tool invocation regardless of how it was triggered.

import { EventEmitter } from 'node:events';

const RING_SIZE = 100;
const ring = [];

/** Emits a `call` event for every recorded tool invocation. */
export const activity = new EventEmitter();
activity.setMaxListeners(0); // many concurrent SSE subscribers

/** Record a tool-call log entry: { id, ts, tool, system, capability, args, ms, status }. */
export function recordCall(entry) {
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
  activity.emit('call', entry);
  return entry;
}

/** Most-recent calls, newest first (default 50). */
export function recentCalls(limit = 50) {
  return ring.slice(-limit).reverse();
}
