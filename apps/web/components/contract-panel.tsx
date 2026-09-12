"use client";

import { explorerAddressUrl, explorerTokenUrl, type OnChainPurchase, PAYMENT_CHAIN_NAME, paymentsContractAddress, serviceKey, USDC_ADDRESS } from "@apiritivo/payments";
import { type ProviderStats, readProviderStats, readRecentPurchases, readServiceStats, type ServiceStats } from "@apiritivo/payments/browser";
import { formatAccessDuration, formatPriceUsdc } from "@apiritivo/shared";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { Button, Disclosure } from "./ui";

/**
 * "On-chain" panel for the Avalanche bounty: contract address, live stats read
 * from the contract and the latest purchases, all linked to Snowtrace.
 * Filter by service or provider.
 */
export function ContractPanel({
  serviceId,
  provider,
  title = "Payment activity",
  refreshKey = 0,
}: {
  serviceId?: string;
  provider?: Address;
  title?: string /** Bump to re-read the contract (e.g. after a live sale). */;
  refreshKey?: number;
}) {
  const contract = paymentsContractAddress();
  const [serviceStats, setServiceStats] = useState<ServiceStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStats | null>(null);
  const [purchases, setPurchases] = useState<OnChainPurchase[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!contract) return;
    let cancelled = false;
    (async () => {
      const [s, p, list] = await Promise.all([
        serviceId ? readServiceStats(serviceId).catch(() => null) : Promise.resolve(null),
        provider ? readProviderStats(provider).catch(() => null) : Promise.resolve(null),
        readRecentPurchases(50).catch(() => null),
      ]);
      if (cancelled) return;
      setServiceStats(s);
      setProviderStats(p);
      const key = serviceId ? serviceKey(serviceId).toLowerCase() : null;
      setPurchases(
        (list ?? []).filter((x) => (key ? x.serviceKey.toLowerCase() === key : true) && (provider ? x.provider.toLowerCase() === provider.toLowerCase() : true)).slice(0, 10),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [contract, serviceId, provider, tick, refreshKey]);

  return (
    <Disclosure title={title} meta={PAYMENT_CHAIN_NAME}>
      {contract ? (
        <div className="mb-4 flex justify-end">
          <Button variant="subtle" size="sm" onClick={() => setTick((n) => n + 1)}>
            Refresh
          </Button>
        </div>
      ) : null}
      {!contract ? (
        <p className="text-sm text-subtle">Payments go directly to the provider wallet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="min-w-0 py-2">
            <p className="text-[11px] uppercase tracking-wider text-ink-400">Contract · APIritivoPayments</p>
            <a href={explorerAddressUrl(contract)} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-xs text-ink-100 hover:text-spritz-300">
              {contract} ↗
            </a>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-ink-400">Settlement token · USDC</p>
            <a href={explorerTokenUrl()} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-xs text-ink-300 hover:text-spritz-300">
              {USDC_ADDRESS} ↗
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {serviceStats ? (
              <>
                <Stat label="Service revenue" value={formatPriceUsdc(serviceStats.revenueUsdc)} />
                <Stat label="Purchases" value={String(serviceStats.purchases)} />
              </>
            ) : null}
            {providerStats ? (
              <>
                <Stat label="Lifetime earned" value={formatPriceUsdc(providerStats.totalEarnedUsdc)} />
                <Stat label="Claimable now" value={formatPriceUsdc(providerStats.claimableUsdc)} />
              </>
            ) : null}
          </div>
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-400">Latest purchases</p>
            {purchases === null ? (
              <p className="text-xs text-ink-400">Loading…</p>
            ) : purchases.length === 0 ? (
              <p className="text-xs text-ink-400">No purchases yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {purchases.map((p) => (
                  <li key={`${p.purchaseId}-${p.timestamp}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                    <span className="font-mono text-ink-300">#{p.purchaseId}</span>
                    <span className="font-semibold text-olive-400">{formatPriceUsdc(p.amountUsdc)}</span>
                    <span className="text-ink-400">{formatAccessDuration(p.accessSeconds)}</span>
                    <a href={explorerAddressUrl(p.buyer)} target="_blank" rel="noreferrer" className="font-mono text-ink-400 hover:text-ink-100">
                      {p.buyer.slice(0, 6)}…{p.buyer.slice(-4)}
                    </a>
                    <span className="text-ink-400">{new Date(p.timestamp * 1000).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Disclosure>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 py-2">
      <p className="text-[11px] uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
