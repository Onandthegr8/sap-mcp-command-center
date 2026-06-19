# SAP MCP Command Center

Three synthetic **SAP systems** behind **one** Model Context Protocol (MCP) gateway, wrapped in a
Next.js dashboard and a plain-English "command center" with a live MCP tool-call feed.

Open the web app, type a question like _"Which materials are below reorder point in Frankfurt?"_,
and watch it become a **real MCP tool call** that returns SAP-like data as tables and charts — the
same tools are simultaneously connectable from Claude Desktop.

> **Synthetic data — no real SAP required.** All data is generated locally with a fixed seed.
> **Rule-based NL — no LLM, no API key.** Plain-English routing is 100% deterministic, so a live
> demo never hits a rate limit or "the API is down" moment.

---

## Screenshots

<!-- TODO: drop images in /docs and update these links -->
- **Dashboard** — `docs/dashboard.png` _(KPIs, sales trend, inventory by plant, order-status donuts, top customers/materials)_
- **Command Center** — `docs/command-center.png` _(chat on the left, live MCP tool-call feed on the right)_
- **Systems** — `docs/systems.png` _(three auto-registered systems and the tools each exposes)_

---

## The 3-layer story

The same MCP pattern, applied at three layers of the SAP stack:

| System   | Layer            | Stands in for            | Example tools |
|----------|------------------|--------------------------|---------------|
| `sap_erp` | master data      | the "MySQL" layer (ECC)  | `sap_erp_get_material`, `sap_erp_list_materials`, `sap_erp_get_customer` |
| `sap_s4`  | transactional    | S/4HANA OData            | `sap_s4_get_sales_orders`, `sap_s4_get_purchase_orders`, `sap_s4_get_deliveries` |
| `sap_bw`  | analytics        | BW / BICS (BEx queries)  | `sap_bw_list_queries`, `sap_bw_run_query` |

Each is exposed as MCP tools through one gateway, and every tool returns flat JSON with a top-level
`status` field — echoing a real BEx server's contract.

### Architecture

```
                         Browser (Next.js :3000)
                    plain English │        │ dashboard data
                                  ▼        ▼
   Claude Desktop            ┌─────────────────────────────────┐
        │  MCP SSE           │   Express gateway  (:3041)       │
        └───────────────────▶   /sse        /api/ask           │
                             │   /api/dashboard  /api/activity  │
                             └──────────────┬──────────────────┘
                                            │  the SAME tool handlers
                          ┌─────────────────┼─────────────────┐
                          ▼                 ▼                 ▼
                      sap_erp            sap_s4            sap_bw
                    (master data)    (transactional)    (analytics)
                          └─────────────────┴─────────────────┘
                                            ▼
                                  SQLite (synthetic, seeded)
```

A plain-English question and an MCP client call land on the **same** config-driven tool handlers,
which read from a local SQLite database seeded with realistic, German-plant SAP data.

---

## Quickstart

```bash
git clone <your-repo-url> sap-mcp-command-center
cd sap-mcp-command-center

npm install      # installs server + web workspaces
npm run seed     # build the synthetic SQLite database (stable, fixed seed)
npm run dev      # start the gateway and the web app together
```

Then open:

- **Web app** → http://localhost:3000
- **Gateway** → http://localhost:3041 (`/health`, `/api/systems`, MCP SSE at `/sse`)

> Ports are configurable: `PORT` for the gateway, `NEXT_PUBLIC_API_BASE` for the web app.
> (The gateway defaults to **3041** to avoid colliding with other local dev servers on 3000/3001.)

### Scripts

| Command | What it does |
|---|---|
| `npm run dev`   | Start gateway + web together (via `concurrently`) |
| `npm run seed`  | Wipe + rebuild the synthetic database, print row counts |
| `npm run reset` | Alias for `seed` — restore the demo to a known state |
| `npm run smoke` | Run the backend smoke suite (data → gateway → NL router → REST) |
| `npm run build` | Production build of the web app |

---

## Try it in plain English

Type these into the Command Center (or `POST /api/ask {"text": "..."}`):

- _"Which materials are below reorder point in Frankfurt?"_
- _"Top 5 customers by revenue"_
- _"Show open purchase orders"_
- _"Sales trend this year"_
- _"List FERT materials in Munich"_
- _"Deliveries for order 4500000123"_
- _"Ping all systems"_

Each one routes deterministically to a tool, dispatches it through the gateway, and lights up the
live tool-call feed.

---

## What's interesting technically

- **Config-driven MCP tool registration.** Tools are generated from
  [`server/src/systems.config.json`](server/src/systems.config.json). Adding a fourth system entry
  registers all of its tools (`{system}_{capability}`) with **zero code changes** — great for a live
  "watch me add a system" demo.
- **One set of handlers, two front doors.** The exact same tool handlers serve both the **MCP SSE
  transport** (real protocol, connectable from Claude Desktop) and the **REST bridge** the web UI
  calls. That's what lets this be a real MCP server _and_ a slick web app from one codebase.
- **Live tool-call telemetry.** Every invocation — whether from MCP or REST — is timed and pushed
  through a ring buffer + event emitter, then streamed to the UI over Server-Sent Events.
- **Deterministic NL routing.** A small ordered set of intent rules + entity extractors (plant
  names → codes, statuses, time phrases, document numbers) maps English to tool calls. No model, no
  key, fully reproducible.
- **Stable demo data.** A fixed `@faker-js/faker` seed means the numbers are identical on every
  `npm run seed`, so your screenshots and talk track always match.

---

## Connect Claude Desktop

The gateway exposes a **real MCP SSE endpoint** at `http://localhost:3041/sse`, so a technical
reviewer can drive the same synthetic systems from Claude Desktop in plain English.

**Option A — Connectors UI (recommended):** Claude Desktop → **Settings → Connectors → Add custom
connector**, then paste the SSE URL:

```
http://localhost:3041/sse
```

**Option B — config file** (`claude_desktop_config.json`), bridging SSE via `mcp-remote`:

```json
{
  "mcpServers": {
    "sap-mcp-command-center": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3041/sse"]
    }
  }
}
```

A ready-to-copy version lives in [`claude_desktop_config.example.json`](claude_desktop_config.example.json).
Make sure the gateway is running (`npm run dev`), then restart Claude Desktop. You'll see
`list_systems` plus the per-system tools (`sap_erp_get_material`, `sap_bw_run_query`, …). Verify the
endpoint is reachable any time with:

```bash
curl http://localhost:3041/health
curl -N http://localhost:3041/sse   # opens the event stream (Ctrl-C to stop)
```

---

## Project structure

```
server/
  src/
    data/        db.js · generate.js (faker seed) · analytics.js (BW-style queries)
    mcp/         tools.js (capability registry) · gateway.js (config-driven registration)
                 transport.js (SSE) · telemetry.js (ring buffer + emitter)
    nl/          router.js (rule-based plain-English → tool call)
    rest.js      REST bridge (/api/*)
    index.js     Express app: MCP SSE + REST
    systems.config.json
  test/          *.smoke.js — one per backend stage
web/
  app/           dashboard · command-center · systems (App Router)
  components/     charts, panels, the live ActivityFeed, shape-aware ResultView
  lib/           typed API client + formatting
```

---

## Notes on choices

- **Rule-based NL** keeps the demo key-free and 100% reliable — no rate limits in front of a reviewer.
- **Shared tool handlers** across MCP SSE and the REST bridge are what make "this is a real MCP
  server" and "here's a polished web UI" both true at once.
- **SQLite + fixed seed** means stable numbers every run.

_Synthetic data only. This project never connects to a real SAP system and uses no LLM API key._
