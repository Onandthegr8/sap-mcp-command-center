"use client";

import { useEffect, useRef, useState } from "react";
import { ask, type AskResponse } from "@/lib/api";
import { ResultView } from "@/components/command/ResultView";
import { ActivityFeed } from "@/components/command/ActivityFeed";

const SUGGESTIONS = [
  "Which materials are below reorder point?",
  "Top 5 customers by revenue",
  "Show open purchase orders",
  "Sales trend this year",
  "Ping all systems",
];

type Message = { id: number; role: "user" | "assistant"; text?: string; data?: AskResponse };

export default function CommandCenterPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function submit(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: ++idRef.current, role: "user", text: q }]);
    setBusy(true);
    try {
      const data = await ask(q);
      setMessages((m) => [...m, { id: ++idRef.current, role: "assistant", data }]);
    } catch {
      setToast("Server unreachable — is the gateway running on :3001?");
      setMessages((m) => [
        ...m,
        { id: ++idRef.current, role: "assistant", text: "⚠️ Couldn't reach the gateway." },
      ]);
      window.setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-7rem)] lg:flex-row">
      {/* Left — Ask */}
      <section className="panel flex min-h-[420px] flex-1 flex-col lg:w-1/2">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Ask</h2>
          <p className="text-xs text-slate-500">Plain English → a real MCP tool call. No LLM, no API key.</p>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-600">
              Ask about materials, orders, customers, or KPIs — or tap a suggestion below.
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-sky-500/15 px-3 py-2 text-sm text-sky-100">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-800 bg-slate-900/60 px-3 py-2">
                  {m.data ? <ResultView data={m.data} /> : <p className="text-sm text-rose-300">{m.text}</p>}
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-slate-800 bg-slate-900/60 px-3 py-3">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                disabled={busy}
                className="rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-sky-500/50 hover:text-sky-300 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the synthetic SAP systems…"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500/60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ask
            </button>
          </form>
        </div>
      </section>

      {/* Right — live MCP tool-call feed */}
      <ActivityFeed className="lg:w-1/2" />

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
