# CLAUDE.md — sap-mcp-command-center

> This file is the source of truth for the project. Re-read it at the start of every session
> and stay within the agreed architecture. If a request would break a NON-NEGOTIABLE, stop and flag it.

## PROJECT

**sap-mcp-command-center**

## GOAL

A portfolio/demo project that wraps three synthetic "SAP systems" behind ONE Model Context
Protocol (MCP) gateway, with a Next.js dashboard and a plain-English command center. It must run
with **no real SAP system and no LLM API key**. Everything is driven by synthetic data and
rule-based natural-language routing.

## THE STORY (why this exists)

The same MCP pattern applied at three layers of the SAP stack:

- **`sap_erp`** = master-data layer (the "MySQL" story): materials, customers, vendors, plants
- **`sap_s4`**  = transactional OData layer: sales orders, purchase orders, deliveries
- **`sap_bw`**  = BW/BICS analytics layer: aggregated KPI queries (BEx-style)

Each is exposed as MCP tools through one gateway. A recruiter can open the web app, type plain
English, and watch real MCP tool calls return SAP-like data as charts and tables.

## ARCHITECTURE

```
/server  — Node.js (ESM). Express 4 + @modelcontextprotocol/sdk.
           - A single MCP gateway exposing an SSE endpoint at /sse
             (real, connectable from Claude Desktop).
           - Tools are CONFIG-DRIVEN via server/src/systems.config.json:
             adding a system entry auto-registers its tools with zero code changes.
           - Synthetic data lives in a local SQLite DB (better-sqlite3),
             seeded by a generator using @faker-js/faker.
           - The SAME tool handlers are shared between the MCP SSE transport
             AND a REST bridge (/api/ask) the web UI calls.
           - A rule-based NL router maps plain English -> a tool call
             (no LLM, no API key).

/web     — Next.js (App Router) + TypeScript + Tailwind + Recharts.
           - Dashboard (KPIs + charts + tables),
             Command Center (chat + live MCP tool-call feed),
             Systems view (ping status).
```

### ASCII overview

```
    Browser (Next.js)
        |  plain English        |  dashboard data
        v                       v
    /api/ask  (REST bridge) --> NL router --> tool dispatch --> SQLite
        ^                                         |
        |                                         v
    Claude Desktop --- MCP SSE /sse ------> SAME tool handlers
```

## NON-NEGOTIABLES

- **No real SAP.** No network calls to SAP. All data synthetic.
- **No LLM/Anthropic API key anywhere.** NL routing is deterministic
  (regex/keyword/intent + entity extraction).
- **Realistic SAP flavor:** INR currency (₹, displayed with en-IN lakh/crore grouping),
  German plant codes (1000 Hamburg, 2000 Frankfurt, 3000 Munich, 4000 Berlin), material types
  FERT/HALB/ROH, 8-digit-ish material numbers, document numbers, dates spread
  across the last 18 months so trends look real.
  (Note: internal DB columns / JSON keys keep the legacy `_eur` suffix — currency is a display
  concern handled in `web/lib/format.ts`. Don't rename the keys.)
- **`npm run dev` at the repo root starts BOTH server and web together** (use `concurrently`).
  Document ports.
- **Keep hand-written code small and readable;** this is a showcase. Heavy stuff is dependencies.

## TECH

Node 20+, ESM modules, Express 4, `@modelcontextprotocol/sdk`, `better-sqlite3`,
`@faker-js/faker`, Next.js 14+ App Router, TypeScript, TailwindCSS, Recharts, `concurrently`.

## CODING RULES

- ESM everywhere in `/server` (`"type": "module"`).
- Every tool handler returns **flat JSON with a top-level `"status"` field** (`"ok"`/`"error"`)
  to echo the BEx server's contract.
- Each tool call is logged with `{ tool, system, args, ms, status }` so the UI can show an
  activity feed.
- Write a smoke-test script for each backend stage.

## PORTS

- **server** (Express + MCP gateway + REST bridge): `http://localhost:3041`
- **web** (Next.js): `http://localhost:3000`

> The gateway uses 3041 (not the more common 3001) to avoid colliding with other local dev
> servers. Override with the `PORT` env var (server) and `NEXT_PUBLIC_API_BASE` (web).

## BUILD STAGES

The project is built in this order; each stage is verified before moving on:

1. **data** — SQLite schema + deterministic faker seed + BW-style analytics helpers.
2. **gateway** — config-driven MCP gateway: capability registry + dynamic per-system tool
   registration + SSE transport + tool-call telemetry (ring buffer + event emitter).
3. **NL router** — deterministic plain-English → tool-call routing (intent rules + entity
   extraction), dispatched through the SAME gateway handlers.
4. **REST bridge** — `/api/systems`, `/api/dashboard`, `/api/ask`, `/api/activity`,
   `/api/activity/stream`; reuses gateway handlers + NL router, CORS for the Next.js origin.
5. **dashboard** — Next.js dashboard (KPI cards + Recharts) + Systems page, typed API client.
6. **command center** — chat panel (plain English → shape-aware rendering) beside a live MCP
   tool-call feed (SSE).
7. **polish** — README + DEMO script + Claude Desktop hookup, reset script, dead-code/console
   cleanup, full smoke suite.
