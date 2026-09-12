"use client";

import { useEffect, useState } from "react";
import type { AccessPass } from "@apiritivo/shared";
import { formatPassBearer } from "@apiritivo/arkiv";
import { useSwarmWallet } from "./swarm-wallet";

export type PassBearer =
  | { status: "loading" }
  | { status: "ready"; bearer: string }
  | { status: "legacy" }
  | { status: "locked"; error: string };

/**
 * The API key for a pass: `<passKey>.<secret>`. The secret is decrypted from
 * the pass payload with the key derived from the signed-in Swarm ID, so it
 * works on any device and nothing is stored in the browser.
 */
export function usePassBearer(pass: AccessPass | null | undefined): PassBearer {
  const wallet = useSwarmWallet();
  const [state, setState] = useState<PassBearer>({ status: "loading" });
  const blob = pass?.encryptedSecret;
  const passKey = pass?.passKey;

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
    if (wallet.status !== "ready") {
      setState({ status: "loading" });
      return;
    }
    setState({ status: "loading" });
    wallet
      .openPassSecret(blob)
      .then((secret) => {
        if (!cancelled) setState({ status: "ready", bearer: formatPassBearer(passKey, secret) });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "locked", error: "This pass belongs to another Swarm ID." });
      });
    return () => {
      cancelled = true;
    };
  }, [passKey, blob, pass?.secretHash, wallet.status, wallet]);

  return state;
}
