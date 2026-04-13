"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNetwork } from "@/context/NetworkContext";
import { createApi } from "@/lib/api";

export function useApi() {
  const { network } = useNetwork();
  return createApi(network);
}

/**
 * Fetch data once and refetch whenever `blockTick` changes (driven by
 * WebSocket block subscription). Falls back gracefully — if blockTick
 * is 0 it still fetches on mount.
 */
export function useOnBlock<T>(
  fetcher: (api: ReturnType<typeof createApi>) => Promise<T>,
  blockTick: number
) {
  const { network } = useNetwork();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function doFetch() {
      try {
        const api = createApi(network);
        const result = await fetcher(api);
        if (!cancelled && mountedRef.current) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled && mountedRef.current) {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    }
    doFetch();
    return () => { cancelled = true; };
  }, [network, fetcher, blockTick]);

  return { data, error, loading };
}

/**
 * Legacy polling hook — still useful for pages that don't use the
 * WebSocket subscription (e.g. account detail, governance).
 */
export function usePolling<T>(
  fetcher: (api: ReturnType<typeof createApi>) => Promise<T>,
  intervalMs = 3000
) {
  const { network } = useNetwork();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const api = createApi(network);
      const result = await fetcher(api);
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [network, fetcher]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchData, intervalMs]);

  return { data, error, loading };
}
