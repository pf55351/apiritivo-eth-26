"use client";

import { PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import { useState } from "react";
import { copyText } from "@/lib/format";
import { shortAddress } from "@/lib/identity";
import { useInjectedWallet } from "@/lib/injected-wallet";
import { useSession } from "@/lib/session";
import { AccountDropdown, GuestAccountIcon } from "./account-dropdown";
import { AccountPanel } from "./account-panel";
import { Button, ProfileAvatar } from "./ui";

/**
 * Header account control for the Client workspace: the connected wallet is
 * the identity. Swarm ID is optional here and only unlocks private files.
 */
export function WalletMenu() {
  const wallet = useInjectedWallet();
  const session = useSession();
  const [copied, setCopied] = useState(false);
  if (!wallet.address) {
    return (
      <AccountDropdown label="Account settings" trigger={<GuestAccountIcon />}>
        {(close) => (
          <AccountPanel>
            <div className="px-3 py-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  close();
                  void wallet.connect();
                }}
                disabled={wallet.available === false || wallet.status === "connecting"}
              >
                {wallet.status === "connecting" ? "Confirm in wallet" : "Connect wallet"}
              </Button>
            </div>
          </AccountPanel>
        )}
      </AccountDropdown>
    );
  }

  const address = wallet.address;
  const short = shortAddress(address);

  return (
    <AccountDropdown
      label={`Wallet ${short}`}
      trigger={
        <>
          <ProfileAvatar name="Wallet" size={34} />
          <span className="hidden font-mono text-sm xl:block">{short}</span>
        </>
      }
    >
      {(close) => (
        <AccountPanel name="Wallet" address={address}>
          <div className="flex flex-wrap gap-x-4 px-3 py-1 text-xs">
            <button
              type="button"
              className="min-h-11 rounded-control text-subtle hover:text-content"
              onClick={async () => {
                if (await copyText(address)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }
              }}
            >
              {copied ? "Copied" : "Copy address"}
            </button>
          </div>
          <div className="mx-3 my-1 border-t border-line" />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 text-xs">
            <span className="text-muted">Network</span>
            <span className={`inline-flex items-center gap-1.5 ${wallet.onPaymentChain ? "text-success" : "text-warning"}`}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              {wallet.onPaymentChain ? PAYMENT_CHAIN_NAME : "Wrong network"}
            </span>
            {!wallet.onPaymentChain ? (
              <Button size="sm" variant="ghost" onClick={() => void wallet.switchChain()}>
                Switch
              </Button>
            ) : null}
          </div>
          <div className="mx-3 my-1 border-t border-line" />
          {session.identity ? (
            <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <span className="text-muted">Swarm ID</span>
              <span className="min-w-0 truncate text-content">{session.identity.name}</span>
            </div>
          ) : (
            <button
              type="button"
              className="min-h-11 w-full rounded-control px-3 py-2 text-left text-sm hover:bg-surface-active disabled:opacity-50"
              onClick={() => {
                close();
                session.connect();
              }}
              disabled={session.status !== "ready" || session.connecting}
            >
              Sign in with Swarm ID
              <span className="block text-xs text-subtle">Needed for private files</span>
            </button>
          )}
          <button
            type="button"
            className="mt-2 min-h-11 w-full rounded-control px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
            onClick={() => {
              close();
              wallet.disconnect();
            }}
          >
            Disconnect wallet
          </button>
        </AccountPanel>
      )}
    </AccountDropdown>
  );
}
