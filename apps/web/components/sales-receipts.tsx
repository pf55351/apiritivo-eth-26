"use client";

import { arkivEntityUrl } from "@apiritivo/arkiv";
import { explorerTxUrl } from "@apiritivo/payments";
import { formatPriceUsdc, type Sale } from "@apiritivo/shared";
import Link from "next/link";
import { AddressLabel } from "./address-label";
import { EmptyState, EmptyStateIcon } from "./ui";

/** Every sale receipt of the provider, newest first, with the API it belongs to and its proofs. */
export function SalesReceipts({ sales, serviceNames }: { sales: Sale[]; serviceNames: Map<string, string> }) {
  if (sales.length === 0) {
    return <EmptyState icon={<EmptyStateIcon kind="pass" />} title="No sales yet" description="Receipts appear here the moment a pass is minted." />;
  }
  return (
    <ul className="divide-y divide-line">
      {sales.map((x) => (
        <li key={x.saleKey} className="grid min-w-0 gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <div className="min-w-0">
            <Link href={`/services/${x.serviceId}`} className="break-words text-sm font-medium hover:text-accent-text">
              {serviceNames.get(x.serviceId) ?? x.serviceId}
            </Link>
            <p className="mt-0.5 text-[11px] text-subtle">
              <span className="font-mono">buyer {x.buyerId.slice(0, 10)}…</span>
              {x.buyerAddress ? (
                <>
                  {" · paid by "}
                  <AddressLabel address={x.buyerAddress} />
                </>
              ) : null}
              {x.createdAtBlock ? <span className="font-mono">{` · block ${x.createdAtBlock}`}</span> : null}
            </p>
          </div>
          <span className="text-sm font-semibold text-success">+{formatPriceUsdc(x.paidUsdc)}</span>
          <span className="flex flex-wrap gap-x-3 font-mono text-[11px] text-subtle">
            <a href={arkivEntityUrl(x.saleKey)} target="_blank" rel="noreferrer" title="Sale receipt on Arkiv" className="inline-flex min-h-9 items-center hover:text-content">
              receipt ↗
            </a>
            {x.passKey ? (
              <a href={arkivEntityUrl(x.passKey)} target="_blank" rel="noreferrer" title="Access pass on Arkiv" className="inline-flex min-h-9 items-center hover:text-content">
                pass ↗
              </a>
            ) : null}
            <a href={explorerTxUrl(x.txHash)} target="_blank" rel="noreferrer" title="Payment on SnowTrace" className="inline-flex min-h-9 items-center hover:text-content">
              {x.txHash.slice(0, 10)}… ↗
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
