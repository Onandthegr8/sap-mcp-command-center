"use client";

import { useCallback, useEffect, useState } from "react";

/** Minimal data-fetching hook with loading/error state and manual reload. */
export function useAsyncData<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // fn is a stable module-level fetcher; reload via nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return { data, error, loading, reload };
}
