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
 * Who acts in the app: always the signed-in Swarm ID, in both workspaces.
 * Passes are bought under it, its key seals the API key, and its sharing key
 * is what the provider grants private files to.
 */
export type ActiveIdentity = { id: string; name: string };

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Whether the signed-in Swarm ID bought this pass (ids compare exactly). */
export function ownsPass(pass: { buyerId: string }, swarmId: string | null): boolean {
  return Boolean(swarmId) && pass.buyerId === swarmId;
}

export function useActiveIdentity(): ActiveIdentity | null {
  const session = useSession();
  return session.identity ? { id: session.identity.id, name: session.identity.name } : null;
}

export type ActiveAccount = {
  /** Which wallet pays: the Swarm-derived wallet (Provider) or the connected browser wallet (Client). */
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
  /** Connect the paying wallet (Client) or open the Swarm ID sign-in (Provider). */
  connect: () => void;
  refreshBalances: () => Promise<void>;
  /** Always the Swarm ID key: the API key opens on any device where this identity is signed in. */
  sealPassSecret: (secret: Hex) => Promise<string>;
  openPassSecret: (blob: string) => Promise<Hex>;
};

/**
 * The paying account of the current workspace, with one shape for both kinds.
 * Provider: the Swarm-derived wallet. Client: the connected browser wallet
 * (MetaMask, Rabby, Core) pays, the Swarm ID stays the identity. Stable between renders.
 */
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
    const identity = session.identity ? { id: session.identity.id, name: session.identity.name } : null;
    if (view === "provider") {
      return {
        kind: "swarm",
        identity,
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
    // The client never touches the Swarm-derived wallet: its own browser wallet pays.
    // Only the Swarm ID key (which seals the API key) must be ready as well.
    const walletStatus = wallet.status === "connecting" ? "deriving" : wallet.status;
    const status = !identity ? "idle" : swarm.passKeyStatus === "ready" ? walletStatus : swarm.passKeyStatus === "error" ? "error" : "deriving";
    return {
      kind: "wallet",
      identity,
      status,
      address: wallet.address,
      signer: wallet.signer,
      balances: wallet.balances,
      error: wallet.error ?? swarm.passKeyError,
      ensureReady: walletEnsureReady,
      connect: walletConnect,
      refreshBalances: wallet.refreshBalances,
      sealPassSecret: swarm.sealPassSecret,
      openPassSecret: swarm.openPassSecret,
    };
  }, [view, session.identity, session.connect, swarm, wallet, noop, walletConnect, walletEnsureReady]);
}
