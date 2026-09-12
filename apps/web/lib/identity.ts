"use client";

import { type Address, type Hex, PAYMENT_CHAIN_NAME } from "@apiritivo/payments";
import type { Balances, Signer } from "@apiritivo/payments/browser";
import { useCallback, useMemo } from "react";
import type { FriendlyError } from "./errors";
import { useInjectedWallet } from "./injected-wallet";
import { useSession } from "./session";
import { useSwarmWallet } from "./swarm-wallet";
import { useView } from "./view";

/**
 * Who acts in the current workspace. Client = the connected wallet (MetaMask,
 * Rabby, Core); provider = the Swarm ID. Swarm ID may also be signed in while
 * a wallet is the client identity: it is then only used for private files.
 */
export type ActiveIdentity = { kind: "swarm"; id: string; name: string } | { kind: "wallet"; id: string; name: string; address: Address };

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Buyer id of a wallet account: the lowercase address, so lookups never depend on checksum casing. */
export function walletIdentity(address: Address): ActiveIdentity {
  return { kind: "wallet", id: address.toLowerCase(), name: shortAddress(address), address };
}

/** Which of the two accounts can open a pass, judged by who bought it. */
export function passOwner(pass: { buyerId: string }, walletAddress: string | null, swarmId: string | null): "wallet" | "swarm" | null {
  const buyer = pass.buyerId.toLowerCase();
  if (walletAddress && buyer === walletAddress.toLowerCase()) return "wallet";
  if (swarmId && pass.buyerId === swarmId) return "swarm";
  return null;
}

export function useActiveIdentity(): ActiveIdentity | null {
  const session = useSession();
  const wallet = useInjectedWallet();
  const { view } = useView();
  if (view === "provider") return session.identity ? { kind: "swarm", id: session.identity.id, name: session.identity.name } : null;
  return wallet.address ? walletIdentity(wallet.address) : null;
}

export type ActiveAccount = {
  kind: "swarm" | "wallet";
  identity: ActiveIdentity | null;
  /** Mirrors the Swarm wallet states so the readiness rules stay shared. */
  status: "idle" | "deriving" | "ready" | "error";
  address: Address | null;
  signer: Signer | null;
  balances: Balances | null;
  error: FriendlyError | null;
  /** Wallet: switch to Fuji before signing; throws when the wallet stays on another chain. Swarm: nothing to do. */
  ensureReady: () => Promise<void>;
  connect: () => void;
  refreshBalances: () => Promise<void>;
  sealPassSecret: (secret: Hex) => Promise<string>;
  openPassSecret: (blob: string) => Promise<Hex>;
};

/** The paying account of the current workspace, with one shape for both kinds. Stable between renders. */
export function useActiveAccount(): ActiveAccount {
  const session = useSession();
  const swarm = useSwarmWallet();
  const wallet = useInjectedWallet();
  const { view } = useView();
  const walletConnect = useCallback(() => void wallet.connect(), [wallet]);
  const walletEnsureReady = useCallback(async () => {
    if (wallet.onPaymentChain) return;
    const switched = await wallet.switchChain();
    if (!switched) throw new Error(`Switch your wallet to ${PAYMENT_CHAIN_NAME} to continue.`);
  }, [wallet]);
  const noop = useCallback(async () => {}, []);

  return useMemo<ActiveAccount>(() => {
    if (view === "provider") {
      return {
        kind: "swarm",
        identity: session.identity ? { kind: "swarm", id: session.identity.id, name: session.identity.name } : null,
        status: swarm.status,
        address: swarm.address,
        signer: swarm.signer,
        balances: swarm.balances,
        error: swarm.error,
        ensureReady: noop,
        connect: session.connect,
        refreshBalances: swarm.refreshBalances,
        sealPassSecret: swarm.sealPassSecret,
        openPassSecret: swarm.openPassSecret,
      };
    }
    return {
      kind: "wallet",
      identity: wallet.address ? walletIdentity(wallet.address) : null,
      status: wallet.status === "connecting" ? "deriving" : wallet.status,
      address: wallet.address,
      signer: wallet.signer,
      balances: wallet.balances,
      error: wallet.error,
      ensureReady: walletEnsureReady,
      connect: walletConnect,
      refreshBalances: wallet.refreshBalances,
      sealPassSecret: wallet.sealPassSecret,
      openPassSecret: wallet.openPassSecret,
    };
  }, [view, session.identity, session.connect, swarm, wallet, noop, walletConnect, walletEnsureReady]);
}
