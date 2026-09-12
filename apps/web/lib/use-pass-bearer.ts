"use client";

import { formatPassBearer } from "@apiritivo/arkiv";
import type { AccessPass } from "@apiritivo/shared";
import { useEffect, useState } from "react";
import { ownsPass } from "./identity";
import { useSession } from "./session";
import { useSwarmWallet } from "./swarm-wallet";

export type PassBearer = { status: "loading" } | { status: "ready"; bearer: string } | { status: "legacy" } | { status: "locked"; error: string };

/**
 * The API key for a pass: `<passKey>.<secret>`. The secret is decrypted from
 * the pass payload with the key derived from the Swarm ID that bought it.
 * Nothing is stored in the browser, so it works on any device.
 */
export function usePassBearer(pass: AccessPass | null | undefined): PassBearer {
  const session = useSession();
  const swarm = useSwarmWallet();
  const [state, setState] = useState<PassBearer>({ status: "loading" });
  const blob = pass?.encryptedSecret;
  const passKey = pass?.passKey;
  const buyerId = pass?.buyerId ?? null;
  const owned = buyerId ? ownsPass({ buyerId }, session.identity?.id ?? null) : false;
  const swarmReady = swarm.passKeyStatus === "ready";
  const open = swarm.openPassSecret;

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
    if (!owned) {
      setState({ status: "locked", error: "This pass belongs to another Swarm ID." });
      return;
    }
    if (!swarmReady) {
      setState({ status: "loading" });
      return;
    }
    setState({ status: "loading" });
    open(blob)
      .then((secret) => {
        if (!cancelled) setState({ status: "ready", bearer: formatPassBearer(passKey, secret) });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "locked", error: "This pass was sealed by another Swarm ID." });
      });
    return () => {
      cancelled = true;
    };
  }, [passKey, blob, pass?.secretHash, owned, swarmReady, open]);

  return state;
}
