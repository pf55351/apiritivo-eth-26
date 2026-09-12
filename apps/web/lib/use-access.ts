"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccessPass, Sale } from "@apiperitivo/shared";
import { getBlockTiming, listAccessPassesByBuyer, listAccessPassesForService, listSalesByProvider, secondsUntilBlock, type BlockTiming } from "@apiperitivo/arkiv";
import { toFriendlyError, type FriendlyError } from "./errors";

type State<T> = { data: T | null; loading: boolean; error: FriendlyError | null; timing: BlockTiming | null };

function useQuery<T>(key: string | null, load: (key: string) => Promise<T>, fallback: string) {
  const [state, setState] = useState<State<T>>({ data: null, loading: key !== null, error: null, timing: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (key === null) {
      setState({ data: null, loading: false, error: null, timing: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.all([load(key), getBlockTiming().catch(() => null)])
      .then(([data, timing]) => {
        if (!cancelled) setState({ data, loading: false, error: null, timing });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: toFriendlyError(err, fallback), timing: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

export function usePassesForService(serviceId: string | null, buyerId: string | null) {
  const key = serviceId && buyerId ? `${serviceId}::${buyerId}` : null;
  return useQuery<AccessPass[]>(key, (k) => {
    const [s, b] = k.split("::");
    return listAccessPassesForService(s!, b!);
  }, "Could not load your access passes from Arkiv.");
}

export function useMyPasses(buyerId: string | null) {
  return useQuery<AccessPass[]>(buyerId, listAccessPassesByBuyer, "Could not load your access passes from Arkiv.");
}

export function useProviderSales(providerId: string | null) {
  return useQuery<Sale[]>(providerId, listSalesByProvider, "Could not load your sales from Arkiv.");
}

export function remainingSeconds(pass: AccessPass, timing: BlockTiming | null): number | null {
  return timing ? secondsUntilBlock(pass.expiresAtBlock, timing) : null;
}
