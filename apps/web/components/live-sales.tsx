"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { formatPriceUsdc } from "@apiritivo/shared";
import { explorerAddressUrl, explorerTxUrl, isContractMode, PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import type { LiveSale } from "@apiritivo/payments/browser";
import { useLiveSales } from "@/lib/use-live-sales";

/** Pulsing "live" pill for the dashboard header. */
export function LiveDot({ live }: { live: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${live ? "border-olive-400/30 bg-olive-400/10 text-olive-400" : "border-white/15 bg-white/5 text-ink-400"}`}>
      <span className="relative flex h-1.5 w-1.5">
        {live ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" /> : null}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {live ? "Live on chain" : "Offline"}
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
        <div className="fixed bottom-6 right-6 z-30 max-w-sm animate-fade-up rounded-2xl border border-olive-400/40 bg-ink-900/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-olive-400">New sale · {PAYMENT_CHAIN_NAME}</p>
          <p className="mt-1 text-lg font-semibold">+{formatPriceUsdc(toast.amountUsdc)}</p>
          <p className="mt-1 text-xs text-ink-300">
            from{" "}
            <a href={explorerAddressUrl(toast.buyer)} target="_blank" rel="noreferrer" className="font-mono hover:text-ink-100">
              {toast.buyer.slice(0, 6)}…{toast.buyer.slice(-4)}
            </a>{" "}
            ·{" "}
            <a href={explorerTxUrl(toast.txHash)} target="_blank" rel="noreferrer" className="text-spritz-300 hover:underline">
              view tx ↗
            </a>
          </p>
        </div>
      ) : null}

      <section className="card rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-spritz-300">{PAYMENT_CHAIN_NAME}</p>
            <h2 className="mt-1 text-xl font-semibold">Live sales feed</h2>
          </div>
          <LiveDot live={live.live} />
        </div>
        <p className="mt-1 text-sm text-ink-300">
          {isContractMode()
            ? "Watching Purchased events of the payments contract for your address."
            : "Watching USDC transfers to your payout wallet. Each one is a client buying access."}
        </p>
        {live.error ? <p className="mt-2 text-xs text-amber-200">RPC hiccup: {live.error}</p> : null}
        {live.sales.length === 0 ? (
          <p className="mt-4 text-xs text-ink-400">No sales since you opened this page. New ones appear here within a few seconds of confirmation.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/15 bg-ink-900/40">
            {live.sales.map((s) => (
              <li key={`${s.txHash}-${s.purchaseId ?? ""}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold text-olive-400">+{formatPriceUsdc(s.amountUsdc)}</span>
                <a href={explorerAddressUrl(s.buyer)} target="_blank" rel="noreferrer" title="Buyer on SnowTrace" className="font-mono text-xs text-ink-300 hover:text-ink-100">
                  {s.buyer.slice(0, 6)}…{s.buyer.slice(-4)} ↗
                </a>
                <span className="text-xs text-ink-400">{s.mode === "contract" ? `purchase #${s.purchaseId ?? "?"}` : "direct transfer"} · block {s.blockNumber.toString()}</span>
                <a href={explorerTxUrl(s.txHash)} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-ink-400 hover:text-ink-100">
                  {s.txHash.slice(0, 10)}… ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
