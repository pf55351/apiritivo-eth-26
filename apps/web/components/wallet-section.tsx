"use client";

import { PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import { useInjectedWallet } from "@/lib/injected-wallet";
import { useCopy } from "@/lib/use-copy";
import { AddressLabel } from "./address-label";
import { Button, StatusDot } from "./ui";

/**
 * Payment wallet rows of the Client account menu: the browser wallet
 * (MetaMask, Rabby, Core) that pays for passes. It is not the identity;
 * that stays the Swarm ID shown above it. The wallet is connected only at
 * checkout (BuyAccess); here it is shown once connected.
 */
export function WalletSection({ onClose }: { onClose: () => void }) {
  const wallet = useInjectedWallet();
  const { copied, copy } = useCopy();

  if (!wallet.address) {
    return (
      <div className="px-3 py-2">
        <p className="text-xs text-muted">Payment wallet</p>
        <p className="mt-1 text-[11px] text-subtle">
          {wallet.available === false ? "No wallet found. Install MetaMask, Rabby or Core before buying." : `Connected when you buy a pass. Pays in USDC on ${PAYMENT_CHAIN_NAME}.`}
        </p>
      </div>
    );
  }

  const address = wallet.address;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-xs">
        <span className="text-muted">Payment wallet</span>
        <AddressLabel address={address} className="min-w-0 truncate text-content" />
      </div>
      <div className="flex flex-wrap gap-x-4 px-3 py-1 text-xs">
        <button type="button" className="min-h-11 rounded-control text-subtle hover:text-content" onClick={() => void copy("address", address)}>
          {copied === "address" ? "Copied" : "Copy address"}
        </button>
      </div>
      <div className="mx-3 my-1 border-t border-line" />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 text-xs">
        <span className="text-muted">Network</span>
        <StatusDot tone={wallet.onPaymentChain ? "success" : "warning"}>{wallet.onPaymentChain ? PAYMENT_CHAIN_NAME : "Wrong network"}</StatusDot>
        {!wallet.onPaymentChain ? (
          <Button size="sm" variant="ghost" onClick={() => void wallet.switchChain()}>
            Switch
          </Button>
        ) : null}
      </div>
      <button
        type="button"
        className="min-h-11 w-full rounded-control px-3 py-2 text-left text-sm text-muted hover:bg-surface-active"
        onClick={() => {
          onClose();
          wallet.disconnect();
        }}
      >
        Disconnect wallet
      </button>
    </>
  );
}
