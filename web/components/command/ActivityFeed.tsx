"use client";

// Live MCP tool-call feed. Subscribes to GET /api/activity/stream (Server-Sent Events) and
// renders each tool call as it happens — proving every plain-English question becomes a real
// MCP tool call routed through the gateway.

import { useEffect, useState } from "react";
import { activityStreamUrl, getActivity, type ToolCall } from "@/lib/api";

const SYS_BADGE: Record<string, string> = {
  sap_erp: "bg-sky-500/15 text-sky-300",
  sap_s4: "bg-emerald-500/15 text-emerald-300",
  sap_bw: "bg-violet-500/15 text-violet-300",
};

const time = (ts: string) => new Date(ts).toLocaleTimeString("en-US", { hour12: false });

export function ActivityFeed({ className = "" }: { className?: string }) {
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Seed with recent backlog, then go live.
    getActivity()
      .then((d) => setCalls(d.calls))
      .catch(() => {});

    const es = new EventSource(activityStreamUrl());
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data) as ToolCall;
        if (entry?.tool) setCalls((prev) => [entry, ...prev.filter((c) => c.id !== entry.id)].slice(0, 50));
      } catch {
        /* ignore keep-alives / hello */
      }
    };
    return () => es.close();
  }, []);

  return (
    <section className={`panel flex min-h-[420px] flex-col ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">MCP Tool Calls</h2>
          <p className="text-xs text-slate-500">Every question routes through the MCP gateway.</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-600"}`} />
          {connected ? "live" : "offline"}
        </span>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {calls.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-slate-600">
            No tool calls yet — ask something on the left.
          </div>
        ) : (
          calls.map((c) => (
            <div
              key={c.id}
              className="animate-feed-in flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-2"
            >
              <span className="font-mono text-[10px] text-slate-500">{time(c.ts)}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SYS_BADGE[c.system] ?? "bg-slate-700 text-slate-300"}`}>
                {c.system}
              </span>
              <span className="truncate font-mono text-xs text-slate-200" title={c.tool}>
                {c.tool}
              </span>
              <span
                className="ml-auto hidden max-w-[34%] truncate font-mono text-[10px] text-slate-500 sm:inline"
                title={JSON.stringify(c.args)}
              >
                {Object.keys(c.args ?? {}).length ? JSON.stringify(c.args) : ""}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-slate-500">{c.ms}ms</span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  c.status === "ok" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {c.status}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
