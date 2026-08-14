"use client";

import { useEffect, useRef, useState } from "react";

interface DataState<T> {
  data: T | null;
  loading: boolean;
  failed: boolean;
}

/**
 * Fetch JSON from a local API route, optionally re-fetching on an interval.
 * Keeps the last good payload on transient failures.
 */
export function useData<T>(url: string, intervalMs?: number): DataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const hasData = useRef(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as T;
        if (!alive) return;
        hasData.current = true;
        setData(json);
        setFailed(false);
      } catch {
        if (alive && !hasData.current) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    const id = intervalMs ? window.setInterval(load, intervalMs) : undefined;
    return () => {
      alive = false;
      if (id !== undefined) window.clearInterval(id);
    };
  }, [url, intervalMs]);

  return { data, loading, failed };
}
