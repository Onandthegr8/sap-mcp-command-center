// Shared loading / error / empty states.

export function ChartSkeleton({ height = "h-72" }: { height?: string }) {
  return <div className={`shimmer w-full ${height}`} />;
}

export function KpiSkeleton() {
  return (
    <div className="panel p-5">
      <div className="shimmer h-3 w-24" />
      <div className="shimmer mt-3 h-7 w-32" />
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="panel flex flex-col items-start gap-3 border-rose-500/30 bg-rose-500/5 p-5">
      <div>
        <div className="text-sm font-semibold text-rose-300">Couldn&apos;t reach the server</div>
        <div className="mt-1 text-xs text-slate-400">{error.message}</div>
        <div className="mt-1 text-xs text-slate-500">
          Is the gateway running? Start it with <code className="text-slate-300">npm run dev</code>.
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}
