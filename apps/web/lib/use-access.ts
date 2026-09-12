"use client";

import { type BlockTiming, getBlockTiming, listAccessPassesByBuyer, listAccessPassesForService, listSalesByProvider, secondsUntilBlock } from "@apiritivo/arkiv";
import type { AccessPass, Sale } from "@apiritivo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { accessQueryState, emptyAccessQuery, newerBlockTiming } from "./access-query-state";
import { toFriendlyError } from "./errors";
import { watchPassTiming } from "./pass-timing";

export function useAccessQuery<T>(key: string | null, load: (key: string) => Promise<T>, fallback: string, readTiming: () => Promise<BlockTiming> = getBlockTiming) {
  const [state, setState] = useState(() => emptyAccessQuery<T>(key));
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const readTimingRef = useRef(readTiming);
  readTimingRef.current = readTiming;
  useEffect(() => {
    setState((current) => accessQueryState(current, { type: "start", key }));
    if (key === null) {
      return;
    }
    let cancelled = false;
    Promise.all([loadRef.current(key), readTimingRef.current().catch(() => null)])
      .then(([data, timing]) => {
        if (!cancelled) setState((current) => accessQueryState(current, { type: "success", key, data, timing }));
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((current) => accessQueryState(current, { type: "failure", key, error: toFriendlyError(err, fallbackRef.current) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  // Hide a different account's snapshot immediately, before the query effect runs.
  const visible = state.key === key ? state : emptyAccessQuery<T>(key);
  return { ...visible, initialLoading: visible.loading && visible.data === null, refreshing: visible.loading && visible.data !== null, reload };
}

function useLivePassTiming(key: string | null, passes: AccessPass[] | null, initialTiming: BlockTiming | null) {
  const [live, setLive] = useState<{ key: string | null; timing: BlockTiming } | null>(null);
  const timing = newerBlockTiming(initialTiming, live?.key === key ? live.timing : null);
  const timingRef = useRef(timing);
  timingRef.current = timing;
  useEffect(() => watchPassTiming(passes ?? [], timingRef.current, (next) => setLive({ key, timing: next })), [key, passes, initialTiming]);
  return timing;
}

export function usePassesForService(serviceId: string | null, buyerId: string | null) {
  const key = serviceId && buyerId ? `${serviceId}::${buyerId}` : null;
  const query = useAccessQuery<AccessPass[]>(
    key,
    (k) => {
      const [s, b] = k.split("::");
      return listAccessPassesForService(s!, b!);
    },
    "Could not load your access passes from Arkiv.",
  );
  const timing = useLivePassTiming(key, query.data, query.timing);
  return { ...query, timing };
}

export function useMyPasses(buyerId: string | null) {
  const query = useAccessQuery<AccessPass[]>(buyerId, listAccessPassesByBuyer, "Could not load your access passes from Arkiv.");
  const timing = useLivePassTiming(buyerId, query.data, query.timing);
  return { ...query, timing };
}

export function useProviderSales(providerId: string | null) {
  return useAccessQuery<Sale[]>(providerId, listSalesByProvider, "Could not load your sales from Arkiv.");
}

export function remainingSeconds(pass: AccessPass, timing: BlockTiming | null): number | null {
  return timing ? secondsUntilBlock(pass.expiresAtBlock, timing) : null;
}
