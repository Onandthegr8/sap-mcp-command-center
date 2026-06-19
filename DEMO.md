# 60-Second Demo Script

A tight walkthrough for a recruiter or technical reviewer. Reset first so the numbers are pristine.

```bash
npm run reset   # re-seed the synthetic database
npm run dev     # gateway :3041 + web :3000
```

Open **http://localhost:3000**.

---

### 0:00 — Dashboard (10s)
> "This is a portfolio project: three synthetic SAP systems behind one MCP gateway. Everything is
> synthetic data, and the natural-language routing is rule-based — no API key."

Point at the KPI row (inventory value, open orders, low-stock) and the charts (sales trend,
inventory by plant, order-status donuts). Amounts are in ₹ (Indian rupees).

### 0:10 — Systems page (12s)
> "One gateway exposes three layers — master data, transactional, and analytics."

Show the three cards. Each lists its tools (`sap_erp_get_material`, `sap_bw_run_query`, …) and the
caption: **"Tools auto-registered from systems.config.json."**
> "Adding a fourth system is a JSON entry — zero code changes."

### 0:22 — Command Center, question #1 (20s)
Go to **Command Center**. Click the suggestion **"Which materials are below reorder point?"**
(or type _"…below reorder point in Frankfurt"_).

> "Plain English becomes a real MCP tool call."

A clean table appears on the left. Point at the **live MCP tool-call feed on the right** — a new row
(`sap_erp_list_materials`, args, duration, `ok`) just animated in.
> "Every question routes through the MCP gateway — same handlers a Claude Desktop client would hit."

### 0:42 — Question #2 (12s)
Click **"Top 5 customers by revenue"**.

> "This one hits the BW analytics layer."

A `sap_bw_run_query` row appears in the feed; the answer renders as a ranked table.

### 0:54 — Close (6s)
> "Same tools are connectable from Claude Desktop over SSE — it's a real MCP server, not a mock.
> Stable seed, so the numbers are identical every run."

---

**Optional flex:** add a 4th entry to `server/src/systems.config.json`, restart, refresh the Systems
page — its tools appear automatically, proving the zero-code claim on camera.
