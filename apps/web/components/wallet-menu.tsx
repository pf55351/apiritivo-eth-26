"use client";

import { explorerAddressUrl, PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/format";
import { shortAddress } from "@/lib/identity";
import { useInjectedWallet } from "@/lib/injected-wallet";
import { useSession } from "@/lib/session";
import { Button, ProfileAvatar } from "./ui";

/**
 * Header account control for the Client workspace: the connected wallet is
 * the identity. Swarm ID is optional here and only unlocks private files.
 */
export function WalletMenu() {
  const wallet = useInjectedWallet();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!wallet.address) {
    return (
      <Button
        size="sm"
        className="w-11 whitespace-nowrap px-0 sm:w-auto sm:px-2.5"
        onClick={() => void wallet.connect()}
        disabled={wallet.available === false || wallet.status === "connecting"}
      >
        <span className="sr-only sm:not-sr-only">{wallet.status === "connecting" ? "Confirm in wallet" : "Connect wallet"}</span>
        <svg className="h-5 w-5 sm:hidden" aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h11A1.5 1.5 0 0 1 17 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-8Zm10 4h4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
    );
  }

  const address = wallet.address;
  const short = shortAddress(address);

  return (
    <div className="sm:relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Wallet ${short}`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-11 items-center justify-center gap-2 rounded-full border border-transparent p-1 transition-colors hover:border-line hover:bg-surface sm:w-auto sm:justify-start sm:pr-3"
      >
        <ProfileAvatar name="Wallet" size={34} />
        <span className="hidden font-mono text-sm xl:block">{short}</span>
        <span className="hidden text-xs text-subtle sm:inline">▾</span>
      </button>
      {open ? (
        <div className="absolute right-3 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-surface-raised p-2 shadow-xl sm:right-0 sm:top-auto">
          <div className="flex items-center gap-3 px-3 py-2">
            <ProfileAvatar name="Wallet" size={48} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Wallet</p>
              <p className="text-xs text-subtle">Client view</p>
              <p className="truncate font-mono text-[11px] text-subtle" title={address}>
                {address}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 px-3 py-1 text-xs">
            <button
              type="button"
              className="py-1 text-subtle hover:text-content"
              onClick={async () => {
                if (await copyText(address)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }
              }}
            >
              {copied ? "Copied" : "Copy address"}
            </button>
            <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" className="py-1 text-subtle hover:text-content">
              Explorer ↗
            </a>
          </div>
          <div className="mx-2 my-1 border-t border-line" />
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
            <span className={wallet.onPaymentChain ? "text-success" : "text-warning"}>{wallet.onPaymentChain ? PAYMENT_CHAIN_NAME : "Wrong network"}</span>
            {!wallet.onPaymentChain ? (
              <Button size="sm" variant="ghost" onClick={() => void wallet.switchChain()}>
                Switch
              </Button>
            ) : null}
          </div>
          <div className="mx-2 my-1 border-t border-line" />
          {session.identity ? (
            <p className="px-3 py-2 text-xs text-subtle">
              Swarm ID <span className="text-content">{session.identity.name}</span> · private files
            </p>
          ) : (
            <button
              type="button"
              className="min-h-11 w-full rounded-control px-3 py-2 text-left text-sm hover:bg-surface"
              onClick={session.connect}
              disabled={session.status !== "ready" || session.connecting}
            >
              Sign in with Swarm ID
              <span className="block text-xs text-subtle">Needed for private files</span>
            </button>
          )}
          <button
            type="button"
            className="mt-1 min-h-11 w-full rounded-control px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
            onClick={() => {
              setOpen(false);
              wallet.disconnect();
            }}
          >
            Disconnect wallet
          </button>
        </div>
      ) : null}
    </div>
  );
}
