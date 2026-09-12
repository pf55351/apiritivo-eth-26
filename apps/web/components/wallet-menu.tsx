"use client";

import { PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import { shortAddress } from "@/lib/identity";
import { useInjectedWallet } from "@/lib/injected-wallet";
import { useSession } from "@/lib/session";
import { useCopy } from "@/lib/use-copy";
import { useEnsName } from "@/lib/use-ens";
import { AccountDropdown } from "./account-dropdown";
import { AccountPanel } from "./account-panel";
import { EnsClaimName } from "./ens-claim-name";
import { GuestMenu } from "./guest-menu";
import { Button, ProfileAvatar, StatusDot } from "./ui";

/**
 * Header account control for the Client workspace: the connected wallet is
 * the identity. Swarm ID is optional here and only unlocks private files.
 */
export function WalletMenu() {
  const wallet = useInjectedWallet();
  const session = useSession();
  const { copied, copy } = useCopy();
  // ENS primary name of the connected wallet (Sepolia by default): shown instead of the address when set.
  const ensName = useEnsName(wallet.address);
  if (!wallet.address) {
    return (
      <GuestMenu
        action={wallet.status === "connecting" ? "Confirm in wallet" : "Connect wallet"}
        onAction={() => void wallet.connect()}
        disabled={wallet.available === false || wallet.status === "connecting"}
      />
    );
  }

  const address = wallet.address;
  const short = shortAddress(address);
  const display = ensName ?? short;

  return (
    <AccountDropdown
      label={`Wallet ${display}`}
      trigger={
        <>
          <ProfileAvatar name={ensName ?? "Wallet"} size={34} />
          <span className={`hidden text-sm xl:block ${ensName ? "" : "font-mono"}`}>{display}</span>
        </>
      }
    >
      {(close) => (
        <AccountPanel name={ensName ?? "Wallet"} address={address}>
          <div className="flex flex-wrap gap-x-4 px-3 py-1 text-xs">
            <button type="button" className="min-h-11 rounded-control text-subtle hover:text-content" onClick={() => void copy("address", address)}>
              {copied === "address" ? "Copied" : "Copy address"}
            </button>
          </div>
          {ensName ? null : (
            <>
              <div className="mx-3 my-1 border-t border-line" />
              <EnsClaimName address={address} />
            </>
          )}
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
