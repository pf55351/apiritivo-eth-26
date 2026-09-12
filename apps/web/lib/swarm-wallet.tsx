"use client";

import { decryptPassSecret, encryptPassSecret } from "@apiritivo/arkiv";
import type { Address, Hex } from "@apiritivo/payments";
import { type Balances, getBalances, type Signer, secretToPrivateKey, swarmSigner } from "@apiritivo/payments/browser";
import { derivePassEncryptionKey, deriveWalletSecret } from "@apiritivo/swarm";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type FriendlyError, toFriendlyError } from "./errors";
import { useSession } from "./session";

export type SwarmWallet = {
  /** Provider only: the client never uses this wallet, so it stays `idle` there. */
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
  /** The Swarm ID key that seals API keys: derived for every signed-in identity, in both workspaces. */
  passKeyStatus: "idle" | "deriving" | "ready" | "error";
  passKeyError: FriendlyError | null;
};

const Ctx = createContext<SwarmWallet | null>(null);

/**
 * EVM wallet derived from the Swarm ID identity (deriveAppSecret). Same
 * identity → same address on every device; no extension needed. The secret
 * lives only in memory for the session. It is derived only in the Provider
 * workspace: the client pays with its own browser wallet and only needs the
 * pass encryption key, which is derived for every identity.
 */
export function SwarmWalletProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const identityId = session.identity?.id ?? null;
  const providerWorkspace = session.roleLoaded && session.role === "provider";
  const secretRef = useRef<Uint8Array | null>(null);
  const passKeyRef = useRef<Uint8Array | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [status, setStatus] = useState<SwarmWallet["status"]>("idle");
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [passKeyStatus, setPassKeyStatus] = useState<SwarmWallet["passKeyStatus"]>("idle");
  const [passKeyError, setPassKeyError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    passKeyRef.current = null;
    setPassKeyError(null);
    if (!identityId) {
      setPassKeyStatus("idle");
      return;
    }
    let cancelled = false;
    setPassKeyStatus("deriving");
    derivePassEncryptionKey()
      .then((passKey) => {
        if (cancelled) return;
        passKeyRef.current = passKey;
        setPassKeyStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPassKeyStatus("error");
        setPassKeyError(toFriendlyError(err, "Could not derive your Swarm ID key."));
      });
    return () => {
      cancelled = true;
    };
  }, [identityId]);

  useEffect(() => {
    secretRef.current = null;
    setSigner(null);
    setBalances(null);
    setError(null);
    if (!identityId || !providerWorkspace) {
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
  }, [identityId, providerWorkspace]);

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
    if (!passKeyRef.current) throw new Error("Your Swarm ID key is not ready yet.");
    return encryptPassSecret(secret, passKeyRef.current);
  }, []);
  const openPassSecret = useCallback(async (blob: string) => {
    if (!passKeyRef.current) throw new Error("Your Swarm ID key is not ready yet.");
    return decryptPassSecret(blob, passKeyRef.current);
  }, []);

  const value = useMemo<SwarmWallet>(
    () => ({ status, address: signer?.address ?? null, signer, balances, error, refreshBalances, revealPrivateKey, sealPassSecret, openPassSecret, passKeyStatus, passKeyError }),
    [status, signer, balances, error, refreshBalances, revealPrivateKey, sealPassSecret, openPassSecret, passKeyStatus, passKeyError],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSwarmWallet(): SwarmWallet {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSwarmWallet must be used inside <SwarmWalletProvider>");
  return ctx;
}
