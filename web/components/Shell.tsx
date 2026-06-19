"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSystems } from "@/lib/api";
import { DashboardIcon, CommandIcon, SystemsIcon, HubIcon } from "@/components/Icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/command-center", label: "Command Center", Icon: CommandIcon },
  { href: "/systems", label: "Systems", Icon: SystemsIcon },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-16 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40 md:w-60">
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-400">
          <HubIcon className="h-5 w-5" />
        </span>
        <div className="hidden min-w-0 md:block">
          <div className="truncate text-sm font-semibold leading-tight">SAP MCP</div>
          <div className="truncate text-[11px] text-slate-500">Command Center</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sky-500/15 text-sky-300"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
              title={label}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-slate-800 p-3 text-[11px] leading-relaxed text-slate-600 md:block">
        Synthetic data · rule-based NL · no API key
      </div>
    </aside>
  );
}

function TopBar() {
  const [connected, setConnected] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getSystems()
      .then((d) => alive && setConnected(d.systems.filter((s) => s.ping?.status === "ok").length))
      .catch(() => alive && setConnected(0));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur md:px-6">
      <h1 className="truncate text-sm font-semibold tracking-tight text-slate-100 md:text-base">
        SAP MCP Command Center
      </h1>
      <div className="flex items-center gap-2 md:gap-3">
        <span className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {connected === null ? "connecting…" : `${connected} systems connected`}
        </span>
      </div>
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
