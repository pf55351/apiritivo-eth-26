"use client";

import { formatPassBearer } from "@apiritivo/arkiv";
import type { AccessPass } from "@apiritivo/shared";
import { useEffect, useState } from "react";
import { passOwner } from "./identity";
import { useInjectedWallet } from "./injected-wallet";
import { useSession } from "./session";
import { useSwarmWallet } from "./swarm-wallet";

export type PassBearer = { status: "loading" } | { status: "ready"; bearer: string } | { status: "legacy" } | { status: "locked"; error: string };

/**
 * The API key for a pass: `<passKey>.<secret>`. The secret is decrypted from
 * the pass payload with the key of whoever bought it: the connected wallet
 * (one signature per session) or the signed-in Swarm ID. Nothing is stored
 * in the browser, so it works on any device.
 */
export function usePassBearer(pass: AccessPass | null | undefined): PassBearer {
  const session = useSession();
  const swarm = useSwarmWallet();
  const wallet = useInjectedWallet();
  const [state, setState] = useState<PassBearer>({ status: "loading" });
  const blob = pass?.encryptedSecret;
  const passKey = pass?.passKey;
  const buyerId = pass?.buyerId ?? null;
  const owner = buyerId ? passOwner({ buyerId }, wallet.address, session.identity?.id ?? null) : null;
  const swarmReady = swarm.status === "ready";
  const walletReady = wallet.status === "ready";
  const openSwarm = swarm.openPassSecret;
  const openWallet = wallet.openPassSecret;

  useEffect(() => {
    let cancelled = false;
    if (!passKey) {
      setState({ status: "loading" });
      return;
    }
    if (!blob || !pass?.secretHash) {
      setState({ status: "legacy" });
      return;
    }
    if (!owner) {
      setState({ status: "locked", error: "This pass belongs to another account." });
      return;
    }
    if ((owner === "swarm" && !swarmReady) || (owner === "wallet" && !walletReady)) {
      setState({ status: "loading" });
      return;
    }
    setState({ status: "loading" });
    (owner === "swarm" ? openSwarm(blob) : openWallet(blob))
      .then((secret) => {
        if (!cancelled) setState({ status: "ready", bearer: formatPassBearer(passKey, secret) });
      })
      .catch((err: unknown) => {
        const rejected = (err as { name?: string })?.name === "WalletError";
        if (!cancelled) setState({ status: "locked", error: rejected ? "Sign the message in your wallet to reveal the key." : "This pass was sealed by another account." });
      });
    return () => {
      cancelled = true;
    };
  }, [passKey, blob, pass?.secretHash, owner, swarmReady, walletReady, openSwarm, openWallet]);

  return state;
}
