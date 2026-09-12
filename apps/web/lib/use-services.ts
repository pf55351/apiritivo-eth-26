"use client";

import { getService, listServices, listServicesByProvider } from "@apiritivo/arkiv";
import type { ArkivService } from "@apiritivo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { accessQueryState, emptyAccessQuery } from "./access-query-state";
import { toFriendlyError } from "./errors";

/**
 * Tiny data hook around the Arkiv read adapter. `key` identifies the query;
 * when it changes the query re-runs. `null` key = nothing to load.
 */
function useArkivQuery<T>(key: string | null, load: (key: string) => Promise<T>, fallback: string) {
  const [state, setState] = useState(() => emptyAccessQuery<T>(key));
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    setState((current) => accessQueryState(current, { type: "start", key }));
    if (key === null) {
      return;
    }
    let cancelled = false;
    loadRef
      .current(key)
      .then((data) => {
        if (!cancelled) setState((current) => accessQueryState(current, { type: "success", key, data, timing: null }));
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((current) => accessQueryState(current, { type: "failure", key, error: toFriendlyError(err, fallbackRef.current) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const visible = state.key === key ? state : emptyAccessQuery<T>(key);
  return { ...visible, initialLoading: visible.loading && visible.data === null, refreshing: visible.loading && visible.data !== null, reload };
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
