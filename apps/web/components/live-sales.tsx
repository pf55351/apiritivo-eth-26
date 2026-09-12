"use client";

import { type Address, explorerAddressUrl, explorerTxUrl, PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import type { LiveSale } from "@apiritivo/payments/browser";
import { formatPriceUsdc } from "@apiritivo/shared";
import { useEffect, useState } from "react";
import { useLiveSales } from "@/lib/use-live-sales";
import { Disclosure } from "./ui";

/** Pulsing "live" pill for the dashboard header. */
export function LiveDot({ live }: { live: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-normal ${live ? "text-success" : "text-subtle"}`}>
      <span className="relative flex h-1.5 w-1.5">
        {live ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" /> : null}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {live ? "Live" : "Offline"}
    </span>
  );
}

/**
 * Listens to Avalanche Fuji for sales to this provider and shows them the
 * moment they land, before Arkiv has the receipt. `onSale` lets the page
 * refresh its Arkiv-backed lists.
 */
export function LiveSales({ provider, onSale }: { provider: Address | undefined; onSale?: (sale: LiveSale) => void }) {
  const live = useLiveSales(provider, onSale);
  const [toast, setToast] = useState<LiveSale | null>(null);
  const latest = live.sales[0];

  useEffect(() => {
    if (!latest) return;
    setToast(latest);
    const t = setTimeout(() => setToast(null), 8_000);
    return () => clearTimeout(t);
  }, [latest]);

  return (
    <>
      {toast ? (
        <div className="fixed bottom-20 right-4 z-30 max-w-sm animate-fade-up sm:bottom-24 sm:right-6 rounded-2xl border border-success/40 bg-surface/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-xs font-normal text-success">New sale · {PAYMENT_CHAIN_NAME}</p>
          <p className="mt-1 text-lg font-semibold">+{formatPriceUsdc(toast.amountUsdc)}</p>
          <p className="mt-1 text-xs text-muted">
            from{" "}
            <a href={explorerAddressUrl(toast.buyer)} target="_blank" rel="noreferrer" className="font-mono hover:text-content">
              {toast.buyer.slice(0, 6)}…{toast.buyer.slice(-4)}
            </a>{" "}
            ·{" "}
            <a href={explorerTxUrl(toast.txHash)} target="_blank" rel="noreferrer" className="text-accent-text hover:underline">
              view tx ↗
            </a>
          </p>
        </div>
      ) : null}

      <Disclosure title="Live sales" meta={<LiveDot live={live.live} />}>
        {live.error ? <p className="mt-2 text-xs text-warning">RPC hiccup: {live.error}</p> : null}
        {live.sales.length === 0 ? (
          <p className="mt-4 text-xs text-subtle">No new sales this session.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {live.sales.map((s) => (
              <li key={`${s.txHash}-${s.purchaseId ?? ""}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold text-success">+{formatPriceUsdc(s.amountUsdc)}</span>
                <a href={explorerAddressUrl(s.buyer)} target="_blank" rel="noreferrer" title="Buyer on SnowTrace" className="font-mono text-xs text-muted hover:text-content">
                  {s.buyer.slice(0, 6)}…{s.buyer.slice(-4)} ↗
                </a>
                <span className="text-xs text-subtle">
                  {s.mode === "contract" ? `purchase #${s.purchaseId ?? "?"}` : "direct transfer"} · block {s.blockNumber.toString()}
                </span>
                <a href={explorerTxUrl(s.txHash)} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-subtle hover:text-content">
                  {s.txHash.slice(0, 10)}… ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </Disclosure>
    </>
  );
}
