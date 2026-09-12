"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArkivService } from "@apiperitivo/shared";
import { getService, listServices, listServicesByProvider } from "@apiperitivo/arkiv";
import { toFriendlyError, type FriendlyError } from "./errors";

type State<T> = { data: T | null; loading: boolean; error: FriendlyError | null };

/**
 * Tiny data hook around the Arkiv read adapter. `key` identifies the query;
 * when it changes the query re-runs. `null` key = nothing to load.
 */
function useArkivQuery<T>(key: string | null, load: (key: string) => Promise<T>, fallback: string) {
  const [state, setState] = useState<State<T>>({ data: null, loading: key !== null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (key === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    load(key)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: toFriendlyError(err, fallback) });
      });
    return () => {
      cancelled = true;
    };
    // `load` and `fallback` are stable module-level functions / literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

const loadAll = () => listServices();
const loadByProvider = (providerId: string) => listServicesByProvider(providerId);
const loadOne = (serviceId: string) => getService(serviceId);

export function useMarketplace() {
  return useArkivQuery<ArkivService[]>("all", loadAll, "Could not load services from Arkiv.");
}

export function useProviderServices(providerId: string | null) {
  return useArkivQuery<ArkivService[]>(providerId, loadByProvider, "Could not load your services from Arkiv.");
}

export function useService(serviceId: string | null) {
  return useArkivQuery<ArkivService | null>(serviceId, loadOne, "Could not load this service from Arkiv.");
}
