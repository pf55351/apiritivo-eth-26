"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { deriveWalletSecret } from "@apiperitivo/swarm";
import { getBalances, secretToPrivateKey, swarmSigner, type Balances, type Signer } from "@apiperitivo/payments/browser";
import { useSession } from "./session";
import { toFriendlyError, type FriendlyError } from "./errors";

export type SwarmWallet = {
  status: "idle" | "deriving" | "ready" | "error";
  address: Address | null;
  signer: Signer | null;
  balances: Balances | null;
  error: FriendlyError | null;
  refreshBalances: () => Promise<void>;
  /** Returns the hex private key. Only call from an explicit user action. */
  revealPrivateKey: () => `0x${string}` | null;
};

const Ctx = createContext<SwarmWallet | null>(null);

/**
 * EVM wallet derived from the Swarm ID identity (deriveAppSecret). Same
 * identity → same address on every device; no extension needed. The secret
 * lives only in memory for the session.
 */
export function SwarmWalletProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const identityId = session.identity?.id ?? null;
  const secretRef = useRef<Uint8Array | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [status, setStatus] = useState<SwarmWallet["status"]>("idle");
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    secretRef.current = null;
    setSigner(null);
    setBalances(null);
    setError(null);
    if (!identityId) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("deriving");
    deriveWalletSecret()
      .then((secret) => {
        if (cancelled) return;
        secretRef.current = secret;
        setSigner(swarmSigner(secret));
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(toFriendlyError(err, "Could not derive your Swarm wallet."));
      });
    return () => {
      cancelled = true;
    };
  }, [identityId]);

  const refreshBalances = useCallback(async () => {
    if (!signer) return;
    try {
      setBalances(await getBalances(signer.address));
    } catch {
      /* RPC hiccup: keep the previous value */
    }
  }, [signer]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  const revealPrivateKey = useCallback(() => (secretRef.current ? secretToPrivateKey(secretRef.current) : null), []);

  const value = useMemo<SwarmWallet>(
    () => ({ status, address: signer?.address ?? null, signer, balances, error, refreshBalances, revealPrivateKey }),
    [status, signer, balances, error, refreshBalances, revealPrivateKey],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSwarmWallet(): SwarmWallet {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSwarmWallet must be used inside <SwarmWalletProvider>");
  return ctx;
}
