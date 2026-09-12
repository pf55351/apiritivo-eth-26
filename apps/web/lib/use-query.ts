"use client";

import type { BlockTiming } from "@apiritivo/arkiv";
import { useCallback, useEffect, useRef, useState } from "react";
import { toFriendlyError } from "./errors";
import { emptyQuery, queryState } from "./query-state";

/**
 * The one data hook over the Arkiv read adapter. `key` identifies the query;
 * when it changes the query re-runs and the previous snapshot is hidden at
 * once (it may belong to another account). `null` key = nothing to load.
 * `readTiming`, when given, reads the chain clock alongside the data so
 * pass countdowns start from the same block as the list.
 */
export function useQuery<T>(key: string | null, load: (key: string) => Promise<T>, fallback: string, readTiming?: () => Promise<BlockTiming>) {
  const [state, setState] = useState(() => emptyQuery<T>(key));
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const readTimingRef = useRef(readTiming);
  readTimingRef.current = readTiming;

  useEffect(() => {
    setState((current) => queryState(current, { type: "start", key }));
    if (key === null) return;
    let cancelled = false;
    const timing = readTimingRef.current;
    Promise.all([loadRef.current(key), timing ? timing().catch(() => null) : Promise.resolve(null)])
      .then(([data, t]) => {
        if (!cancelled) setState((current) => queryState(current, { type: "success", key, data, timing: t }));
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((current) => queryState(current, { type: "failure", key, error: toFriendlyError(err, fallbackRef.current) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const visible = state.key === key ? state : emptyQuery<T>(key);
  return { ...visible, initialLoading: visible.loading && visible.data === null, refreshing: visible.loading && visible.data !== null, reload };
}

export type QueryResult<T> = ReturnType<typeof useQuery<T>>;
