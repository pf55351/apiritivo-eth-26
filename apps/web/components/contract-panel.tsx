"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { formatAccessDuration, formatPriceUsdc } from "@apiritivo/shared";
import { explorerAddressUrl, explorerTokenUrl, paymentsContractAddress, serviceKey, PAYMENT_CHAIN_NAME, USDC_ADDRESS, type OnChainPurchase } from "@apiritivo/payments";
import { readProviderStats, readRecentPurchases, readServiceStats, type ProviderStats, type ServiceStats } from "@apiritivo/payments/browser";

/**
 * "On-chain" panel for the Avalanche bounty: contract address, live stats read
 * from the contract and the latest purchases, all linked to Snowtrace.
 * Filter by service or provider.
 */
export function ContractPanel({ serviceId, provider, title = "On-chain payments", refreshKey = 0 }: { serviceId?: string; provider?: Address; title?: string; /** Bump to re-read the contract (e.g. after a live sale). */ refreshKey?: number }) {
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
    <section className="card rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">{PAYMENT_CHAIN_NAME}</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        </div>
        {contract ? (
          <button type="button" onClick={() => setTick((n) => n + 1)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-ink-300 hover:text-ink-100">
            Refresh
          </button>
        ) : null}
      </div>

      {!contract ? (
        <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          <p className="font-medium">APIritivoPayments contract not deployed yet.</p>
          <p className="mt-1 text-xs text-amber-200/90">
            Payments currently go straight to the provider wallet. Once deployed (contracts/script/Deploy.s.sol), set{" "}
            <code className="font-mono">NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS</code> and this panel shows the contract, its revenue counters and every purchase.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-white/15 bg-ink-900/60 p-3">
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
              <ul className="divide-y divide-white/10 rounded-2xl border border-white/15">
                {purchases.map((p) => (
                  <li key={`${p.purchaseId}-${p.timestamp}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
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
          <p className="text-[11px] text-ink-400">
            Every purchase is a <code className="font-mono">Purchased</code> event; the app server verifies that event before minting the Arkiv access pass.{" "}
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-ink-900/60 p-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
