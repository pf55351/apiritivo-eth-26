"use client";

import { decryptPassSecret, encryptPassSecret } from "@apiritivo/arkiv";
import { PAYMENT_CHAIN_ID } from "@apiritivo/payments";
import {
  type Balances,
  ensurePaymentChain,
  getBalances,
  hasInjectedWallet,
  injectedSigner,
  onWalletChange,
  reconnectInjectedWallet,
  type Signer,
  signPassKeyMessage,
  walletChainId,
} from "@apiritivo/payments/browser";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import type { FriendlyError } from "./errors";

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
  /** Switch (or add) Avalanche Fuji in the wallet. */
  switchChain: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  /** Encrypt a pass secret under a key derived from one wallet signature (asked once per account and session). */
  sealPassSecret: (secret: Hex) => Promise<string>;
  /** Decrypt a pass secret; throws when the pass was sealed by another account. */
  openPassSecret: (blob: string) => Promise<Hex>;
};

const Ctx = createContext<InjectedWallet | null>(null);

function friendly(err: unknown, fallback: string): FriendlyError {
  const e = err as { name?: string; message?: string; stack?: string };
  const message = e?.name === "WalletError" && e.message ? e.message : fallback;
  return { message, detail: e?.stack ?? String(err) };
}

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
 * MetaMask / Rabby / Core account used as the client identity. The wallet
 * signs payments; a single `personal_sign` derives the key that protects the
 * API keys, so the same account recovers them on any device.
 */
export function InjectedWalletProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<InjectedWallet["status"]>("idle");
  const [signer, setSigner] = useState<Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  // One derived key per account, and one in-flight signature so parallel callers share the prompt.
  const keysRef = useRef(new Map<string, Promise<Uint8Array>>());

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

  // Account or chain changed in the wallet UI.
  useEffect(() => {
    if (!available) return;
    return onWalletChange(() => {
      keysRef.current.clear();
      if (!remembered()) return;
      void reconnectInjectedWallet().then((s) => adopt(s));
    });
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
      setError(friendly(err, "Wallet connection failed."));
    }
  }, [adopt]);

  const disconnect = useCallback(() => {
    remember(false);
    keysRef.current.clear();
    setSigner(null);
    setBalances(null);
    setError(null);
    setStatus("idle");
  }, []);

  const switchChain = useCallback(async () => {
    setError(null);
    try {
      await ensurePaymentChain();
      setChainId(await walletChainId());
    } catch (err) {
      setError(friendly(err, "Could not switch network."));
    }
  }, []);

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

  const passKey = useCallback(async (): Promise<Uint8Array> => {
    if (!signer) throw new Error("Connect a wallet first.");
    const id = signer.address.toLowerCase();
    let pending = keysRef.current.get(id);
    if (!pending) {
      pending = signPassKeyMessage(signer).catch((err) => {
        keysRef.current.delete(id);
        throw err;
      });
      keysRef.current.set(id, pending);
    }
    return pending;
  }, [signer]);

  const sealPassSecret = useCallback(async (secret: Hex) => encryptPassSecret(secret, await passKey()), [passKey]);
  const openPassSecret = useCallback(async (blob: string) => decryptPassSecret(blob, await passKey()), [passKey]);

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
      sealPassSecret,
      openPassSecret,
    }),
    [available, status, signer, chainId, balances, error, connect, disconnect, switchChain, refreshBalances, sealPassSecret, openPassSecret],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInjectedWallet(): InjectedWallet {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInjectedWallet must be used inside <InjectedWalletProvider>");
  return ctx;
}
