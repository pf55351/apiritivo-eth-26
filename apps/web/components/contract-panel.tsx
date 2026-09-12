"use client";

import {
  type Address,
  explorerAddressUrl,
  explorerTokenUrl,
  type OnChainPurchase,
  PAYMENT_CHAIN_NAME,
  paymentsContractAddress,
  serviceKey,
  USDC_ADDRESS,
} from "@apiritivo/payments";
import { type ProviderStats, readProviderStats, readRecentPurchases, readServiceStats, type ServiceStats } from "@apiritivo/payments/browser";
import { formatAccessDuration, formatPriceUsdc } from "@apiritivo/shared";
import { type ReactNode, useEffect, useState } from "react";
import { invalidateRequest, sharedRequest } from "@/lib/shared-request";
import { AddressLabel } from "./address-label";
import { RefreshButton } from "./refresh-button";
import { Disclosure } from "./ui";

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
  inline = false,
}: {
  serviceId?: string;
  provider?: Address;
  title?: string;
  /** Bump to re-read the contract (e.g. after a live sale). */
  refreshKey?: number;
  /** Render open, without the disclosure: the Sales page shows the activity directly. */
  inline?: boolean;
}) {
  const contract = paymentsContractAddress();
  const [serviceStats, setServiceStats] = useState<ServiceStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStats | null>(null);
  const [purchases, setPurchases] = useState<OnChainPurchase[] | null>(null);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contract) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [s, p, list] = await Promise.all([
        serviceId ? readServiceStats(serviceId).catch(() => null) : Promise.resolve(null),
        // Same read the wallet panel makes on the provider page: one request serves both.
        provider ? sharedRequest(`provider-stats:${provider.toLowerCase()}`, () => readProviderStats(provider)).catch(() => null) : Promise.resolve(null),
        readRecentPurchases(50).catch(() => null),
      ]);
      if (cancelled) return;
      setServiceStats(s);
      setProviderStats(p);
      const key = serviceId ? serviceKey(serviceId).toLowerCase() : null;
      setPurchases(
        (list ?? []).filter((x) => (key ? x.serviceKey.toLowerCase() === key : true) && (provider ? x.provider.toLowerCase() === provider.toLowerCase() : true)).slice(0, 10),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [contract, serviceId, provider, tick, refreshKey]);

  const refresh = contract ? (
    <RefreshButton
      variant="subtle"
      refreshing={loading}
      onClick={() => {
        invalidateRequest("provider-stats");
        setTick((n) => n + 1);
      }}
    />
  ) : null;
  const frame = (children: ReactNode) =>
    inline ? (
      <section aria-label={title} className="pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-subtle">{PAYMENT_CHAIN_NAME}</p>
          {refresh}
        </div>
        {children}
      </section>
    ) : (
      <Disclosure title={title} meta={PAYMENT_CHAIN_NAME}>
        {refresh ? <div className="mb-4 flex justify-end">{refresh}</div> : null}
        {children}
      </Disclosure>
    );

  return frame(
    !contract ? (
      <p className="text-sm text-subtle">Payments go directly to the provider wallet.</p>
    ) : (
      <div className="mt-4 space-y-4">
        <div className="min-w-0 py-2">
          <p className="text-[11px] uppercase tracking-wider text-subtle">Contract · APIritivoPayments</p>
          <a href={explorerAddressUrl(contract)} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-xs text-content hover:text-accent-text">
            {contract} ↗
          </a>
          <p className="mt-2 text-[11px] uppercase tracking-wider text-subtle">Settlement token · USDC</p>
          <a href={explorerTokenUrl()} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-xs text-muted hover:text-accent-text">
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
          {/* "Ready to claim" lives in the wallet section: one place per metric. */}
          {providerStats ? <Stat label="Lifetime earned" value={formatPriceUsdc(providerStats.totalEarnedUsdc)} /> : null}
        </div>
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-subtle">Latest purchases</p>
          {purchases === null ? (
            <p className="text-xs text-subtle">Loading…</p>
          ) : purchases.length === 0 ? (
            <p className="text-xs text-subtle">No purchases yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="py-2 pr-4 font-medium">#</th>
                    <th className="py-2 pr-4 font-medium">Amount</th>
                    <th className="py-2 pr-4 font-medium">Access</th>
                    <th className="py-2 pr-4 font-medium">Buyer</th>
                    <th className="py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {purchases.map((p) => (
                    <tr key={`${p.purchaseId}-${p.timestamp}`}>
                      <td className="whitespace-nowrap py-3 pr-4 font-mono text-muted">#{p.purchaseId}</td>
                      <td className="whitespace-nowrap py-3 pr-4 font-semibold tabular-nums text-success">{formatPriceUsdc(p.amountUsdc)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-subtle">{formatAccessDuration(p.accessSeconds)}</td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        <a href={explorerAddressUrl(p.buyer)} target="_blank" rel="noreferrer" className="text-subtle hover:text-content">
                          <AddressLabel address={p.buyer} /> ↗
                        </a>
                      </td>
                      <td className="whitespace-nowrap py-3 tabular-nums text-subtle">{new Date(p.timestamp * 1000).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    ),
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 py-2">
      <p className="text-[11px] uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
