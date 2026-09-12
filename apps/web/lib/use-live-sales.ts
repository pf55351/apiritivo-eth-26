"use client";

import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { liveSaleKey, watchSales, type LiveSale } from "@apiritivo/payments/browser";

export type LiveSalesState = {
  /** The chain watcher is running (polling the Fuji RPC). */
  live: boolean;
  /** Newest first, capped. */
  sales: LiveSale[];
  error: string | null;
};

/**
 * Subscribe to on-chain sales for a provider address. `onSale` fires once per
 * new event, after the list is updated, so callers can refresh Arkiv data.
 */
export function useLiveSales(provider: Address | undefined, onSale?: (sale: LiveSale) => void): LiveSalesState {
  const [state, setState] = useState<LiveSalesState>({ live: false, sales: [], error: null });
  const seen = useRef(new Set<string>());
  const cb = useRef(onSale);
  cb.current = onSale;

  useEffect(() => {
    if (!provider) {
      setState({ live: false, sales: [], error: null });
      return;
    }
    seen.current.clear();
    setState({ live: true, sales: [], error: null });
    const stop = watchSales({
      provider,
      onError: (err) => setState((s) => ({ ...s, error: err.message })),
      onSale: (sale) => {
        const key = liveSaleKey(sale);
        if (seen.current.has(key)) return;
        seen.current.add(key);
        setState((s) => ({ ...s, error: null, sales: [sale, ...s.sales].slice(0, 20) }));
        cb.current?.(sale);
      },
    });
    return () => {
      stop();
      setState((s) => ({ ...s, live: false }));
    };
  }, [provider]);

  return state;
}
