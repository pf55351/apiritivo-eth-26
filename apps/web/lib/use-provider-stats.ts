"use client";

import { type Address, isContractMode } from "@apiritivo/payments";
import { type ProviderStats, readProviderStats } from "@apiritivo/payments/browser";
import { useCallback, useEffect, useState } from "react";
import { invalidateRequest, sharedRequest } from "./shared-request";

/** Contract-side numbers of a provider wallet (claimable USDC, totals); one shared request per address. */
export function useProviderStats(address: Address | null, refreshKey = 0) {
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const contractMode = isContractMode();
  const load = useCallback(
    async (fresh = false) => {
      if (!address || !contractMode) return;
      if (fresh) invalidateRequest("provider-stats");
      setStats(await sharedRequest(`provider-stats:${address.toLowerCase()}`, () => readProviderStats(address)).catch(() => null));
    },
    [address, contractMode],
  );
  useEffect(() => {
    void load(refreshKey > 0);
  }, [load, refreshKey]);
  return { stats, reload: () => load(true), contractMode };
}
