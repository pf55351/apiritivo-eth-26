"use client";

import { type BlockTiming, getBlockTiming, listAccessPassesByBuyer, listAccessPassesForService, listSalesByProvider, secondsUntilBlock } from "@apiritivo/arkiv";
import type { AccessPass, Sale } from "@apiritivo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FriendlyError, toFriendlyError } from "./errors";
import { watchPassTiming } from "./pass-timing";

type State<T> = { data: T | null; loading: boolean; error: FriendlyError | null; timing: BlockTiming | null };

function useQuery<T>(key: string | null, load: (key: string) => Promise<T>, fallback: string) {
  const [state, setState] = useState<State<T>>({ data: null, loading: key !== null, error: null, timing: null });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  useEffect(() => {
    if (key === null) {
      setState({ data: null, loading: false, error: null, timing: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.all([loadRef.current(key), getBlockTiming().catch(() => null)])
      .then(([data, timing]) => {
        if (!cancelled) setState({ data, loading: false, error: null, timing });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: toFriendlyError(err, fallbackRef.current), timing: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

function useLivePassTiming(passes: AccessPass[] | null, initialTiming: BlockTiming | null) {
  const [live, setLive] = useState<{ passes: AccessPass[] | null; initialTiming: BlockTiming | null; timing: BlockTiming } | null>(null);
  useEffect(() => watchPassTiming(passes ?? [], initialTiming, (timing) => setLive({ passes, initialTiming, timing })), [passes, initialTiming]);
  return live?.passes === passes && live.initialTiming === initialTiming ? live.timing : initialTiming;
}

export function usePassesForService(serviceId: string | null, buyerId: string | null) {
  const key = serviceId && buyerId ? `${serviceId}::${buyerId}` : null;
  const query = useQuery<AccessPass[]>(
    key,
    (k) => {
      const [s, b] = k.split("::");
      return listAccessPassesForService(s!, b!);
    },
    "Could not load your access passes from Arkiv.",
  );
  const timing = useLivePassTiming(query.data, query.timing);
  return { ...query, timing };
}

export function useMyPasses(buyerId: string | null) {
  const query = useQuery<AccessPass[]>(buyerId, listAccessPassesByBuyer, "Could not load your access passes from Arkiv.");
  const timing = useLivePassTiming(query.data, query.timing);
  return { ...query, timing };
}

export function useProviderSales(providerId: string | null) {
  return useQuery<Sale[]>(providerId, listSalesByProvider, "Could not load your sales from Arkiv.");
}

export function remainingSeconds(pass: AccessPass, timing: BlockTiming | null): number | null {
  return timing ? secondsUntilBlock(pass.expiresAtBlock, timing) : null;
}
