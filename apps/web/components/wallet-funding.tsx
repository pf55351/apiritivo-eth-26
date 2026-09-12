"use client";

import { AVAX_FAUCET_URL, explorerAddressUrl, USDC_FAUCET_URL } from "@apiritivo/payments";
import { useState } from "react";
import { type FriendlyError, toFriendlyError } from "@/lib/errors";
import { RefreshButton } from "./refresh-button";
import { Disclosure, ErrorNotice, RefField } from "./ui";
import { WalletBalances } from "./wallet-balances";

export function WalletFunding({
  label,
  address,
  balances,
  onRefresh,
}: {
  label: string;
  address: string;
  balances: { usdc: string; avax: string } | null;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      await onRefresh();
    } catch (err) {
      setError(toFriendlyError(err, "Could not refresh wallet balances."));
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-xs text-muted">{label}</p>
      <div aria-busy={refreshing}>
        <WalletBalances balances={balances} />
      </div>
      <Disclosure title="Fund wallet">
        <RefField label="Wallet address" value={address} href={explorerAddressUrl(address)} />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-subtle">
          <a className="inline-flex min-h-11 items-center gap-1 text-accent-text hover:underline" href={USDC_FAUCET_URL} target="_blank" rel="noreferrer">
            USDC faucet <span aria-hidden="true">↗</span>
          </a>
          <a className="inline-flex min-h-11 items-center gap-1 text-accent-text hover:underline" href={AVAX_FAUCET_URL} target="_blank" rel="noreferrer">
            AVAX faucet <span aria-hidden="true">↗</span>
          </a>
          <RefreshButton variant="subtle" refreshing={refreshing} onClick={() => void refresh()} />
        </div>
      </Disclosure>
      {error ? <ErrorNotice message={error.message} detail={error.detail} onRetry={() => void refresh()} /> : null}
    </div>
  );
}
