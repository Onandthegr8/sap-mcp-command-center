"use client";

import { getSystems } from "@/lib/api";
import { useAsyncData } from "@/lib/useAsyncData";
import { Panel } from "@/components/Panel";
import { ErrorState } from "@/components/States";

const LAYER_STYLE: Record<string, string> = {
  master: "bg-sky-500/15 text-sky-300",
  transactional: "bg-emerald-500/15 text-emerald-300",
  analytics: "bg-violet-500/15 text-violet-300",
};

export default function SystemsPage() {
  const { data, error, loading, reload } = useAsyncData(getSystems);

  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Connected systems</h2>
        <p className="text-sm text-slate-500">
          Three synthetic SAP layers behind one MCP gateway. Tools auto-registered from{" "}
          <code className="text-slate-300">systems.config.json</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {loading || !data
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="panel h-64 p-5">
                <div className="shimmer h-4 w-40" />
                <div className="shimmer mt-3 h-3 w-24" />
                <div className="shimmer mt-6 h-24 w-full" />
              </div>
            ))
          : data.systems.map((s) => (
              <Panel key={s.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-100">{s.label}</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">{s.id}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${LAYER_STYLE[s.layer] ?? "bg-slate-700 text-slate-300"}`}>
                    {s.layer}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-emerald-300">{s.ping.status === "ok" ? "reachable" : "unreachable"}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-500">{s.tools.length} tools</span>
                </div>

                <div className="mt-4 border-t border-slate-800 pt-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Exposed tools</div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.tools.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-slate-800 bg-slate-800/50 px-2 py-0.5 font-mono text-[11px] text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </Panel>
            ))}
      </div>

      <p className="text-center text-xs text-slate-600">
        Add a 4th entry to <code className="text-slate-400">systems.config.json</code> and its tools appear here
        automatically — zero code changes.
      </p>
    </div>
  );
}
