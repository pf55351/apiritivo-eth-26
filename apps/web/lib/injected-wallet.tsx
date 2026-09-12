"use client";

import { type Address, PAYMENT_CHAIN_ID } from "@apiritivo/payments";
import {
  type Balances,
  ensurePaymentChain,
  getBalances,
  hasInjectedWallet,
  injectedSigner,
  onWalletChange,
  reconnectInjectedWallet,
  type Signer,
  walletChainId,
} from "@apiritivo/payments/browser";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type FriendlyError, toFriendlyError } from "./errors";
import { useSession } from "./session";

const REMEMBER_KEY = "apiritivo:wallet";

export type InjectedWallet = {
  /** null until mounted, then whether window.ethereum exists. */
  available: boolean | null;
  status: "idle" | "connecting" | "ready" | "error";
  address: Address | null;
  signer: Signer | null;
  chainId: number | null;
  onPaymentChain: boolean;
  balances: Balances | null;
  error: FriendlyError | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Switch (or add) Avalanche Fuji in the wallet. Resolves to whether the wallet is on Fuji afterwards. */
  switchChain: () => Promise<boolean>;
  refreshBalances: () => Promise<void>;
};

const Ctx = createContext<InjectedWallet | null>(null);

function remember(on: boolean) {
  try {
    if (on) window.localStorage.setItem(REMEMBER_KEY, "1");
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* localStorage unavailable */
  }
}

function remembered(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * MetaMask / Rabby / Core account that pays in the Client workspace. It only
 * signs payments and the pass claim; the identity, and the key that protects
 * the API keys, stay with the Swarm ID.
 */
export function InjectedWalletProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<InjectedWallet["status"]>("idle");
  const [signer, setSigner] = useState<Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  const adopt = useCallback(async (next: Signer | null) => {
    setSigner(next);
    setStatus(next ? "ready" : "idle");
    setChainId(next ? await walletChainId() : null);
  }, []);

  // Silent reconnect: only accounts the wallet already exposes, never a prompt.
  useEffect(() => {
    const has = hasInjectedWallet();
    setAvailable(has);
    if (!has || !remembered()) return;
    let cancelled = false;
    reconnectInjectedWallet().then((s) => {
      if (!cancelled) void adopt(s);
    });
    return () => {
      cancelled = true;
    };
  }, [adopt]);

  // Account or chain changed in the wallet UI: read the exposed account back.
  useEffect(() => {
    if (!available) return;
    const readopt = () => {
      if (!remembered()) return;
      void reconnectInjectedWallet().then((s) => adopt(s));
    };
    return onWalletChange(readopt, readopt);
  }, [available, adopt]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const next = await injectedSigner();
      remember(true);
      await adopt(next);
    } catch (err) {
      setStatus("error");
      setError(toFriendlyError(err, "Wallet connection failed."));
    }
  }, [adopt]);

  const disconnect = useCallback(() => {
    remember(false);
    setSigner(null);
    setBalances(null);
    setError(null);
    setStatus("idle");
  }, []);

  const switchChain = useCallback(async () => {
    setError(null);
    try {
      await ensurePaymentChain();
    } catch (err) {
      setError(toFriendlyError(err, "Could not switch network."));
    }
    // Read the chain back either way: the user may have switched by hand while the prompt was open.
    const chain = await walletChainId();
    setChainId(chain);
    return chain === PAYMENT_CHAIN_ID;
  }, []);

  // Swarm ID is the only login: signing out also forgets the wallet, so the
  // next purchase connects it again instead of finding it already attached.
  const identityId = useSession().identity?.id ?? null;
  const previousIdentity = useRef<string | null>(null);
  useEffect(() => {
    if (previousIdentity.current && !identityId) disconnect();
    previousIdentity.current = identityId;
  }, [identityId, disconnect]);

  const refreshBalances = useCallback(async () => {
    if (!signer) return;
    try {
      setBalances(await getBalances(signer.address));
    } catch {
      /* RPC hiccup: keep the previous value */
    }
  }, [signer]);

  useEffect(() => {
    setBalances(null);
    void refreshBalances();
  }, [refreshBalances]);

  const value = useMemo<InjectedWallet>(
    () => ({
      available,
      status,
      address: signer?.address ?? null,
      signer,
      chainId,
      onPaymentChain: chainId === PAYMENT_CHAIN_ID,
      balances,
      error,
      connect,
      disconnect,
      switchChain,
      refreshBalances,
    }),
    [available, status, signer, chainId, balances, error, connect, disconnect, switchChain, refreshBalances],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInjectedWallet(): InjectedWallet {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInjectedWallet must be used inside <InjectedWalletProvider>");
  return ctx;
}
