"use client";

import { decryptPassSecret, encryptPassSecret } from "@apiritivo/arkiv";
import type { Address, Hex } from "@apiritivo/payments";
import { type Balances, getBalances, type Signer, secretToPrivateKey, swarmSigner } from "@apiritivo/payments/browser";
import { derivePassEncryptionKey, deriveWalletSecret } from "@apiritivo/swarm";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type FriendlyError, toFriendlyError } from "./errors";
import { useSession } from "./session";

export type SwarmWallet = {
  status: "idle" | "deriving" | "ready" | "error";
  address: Address | null;
  signer: Signer | null;
  balances: Balances | null;
  error: FriendlyError | null;
  refreshBalances: () => Promise<void>;
  /** Returns the hex private key. Only call from an explicit user action. */
  revealPrivateKey: () => `0x${string}` | null;
  /** Encrypt an access-pass secret for this identity (key derived from Swarm ID, never stored). */
  sealPassSecret: (secret: Hex) => Promise<string>;
  /** Decrypt an access-pass secret stored in a pass payload. Throws for another identity's pass. */
  openPassSecret: (blob: string) => Promise<Hex>;
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
  const passKeyRef = useRef<Uint8Array | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [status, setStatus] = useState<SwarmWallet["status"]>("idle");
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    secretRef.current = null;
    passKeyRef.current = null;
    setSigner(null);
    setBalances(null);
    setError(null);
    if (!identityId) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("deriving");
    Promise.all([deriveWalletSecret(), derivePassEncryptionKey()])
      .then(([secret, passKey]) => {
        if (cancelled) return;
        secretRef.current = secret;
        passKeyRef.current = passKey;
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
  const sealPassSecret = useCallback(async (secret: Hex) => {
    if (!passKeyRef.current) throw new Error("Your Swarm wallet is not ready yet.");
    return encryptPassSecret(secret, passKeyRef.current);
  }, []);
  const openPassSecret = useCallback(async (blob: string) => {
    if (!passKeyRef.current) throw new Error("Your Swarm wallet is not ready yet.");
    return decryptPassSecret(blob, passKeyRef.current);
  }, []);

  const value = useMemo<SwarmWallet>(
    () => ({ status, address: signer?.address ?? null, signer, balances, error, refreshBalances, revealPrivateKey, sealPassSecret, openPassSecret }),
    [status, signer, balances, error, refreshBalances, revealPrivateKey, sealPassSecret, openPassSecret],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSwarmWallet(): SwarmWallet {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSwarmWallet must be used inside <SwarmWalletProvider>");
  return ctx;
}
